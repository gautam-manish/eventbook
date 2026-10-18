import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { validationError } from '../utils.js';

const router = Router();

const listQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    search: z.string().trim().max(100).optional(),
});

const eventSchema = z.object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().max(2000).optional(),
    starts_at: z.string().datetime({ offset: true }),
    venue: z.string().trim().min(2).max(150),
    total_seats: z.number().int().min(1).max(10000),
});

const updateSchema = eventSchema
    .partial()
    .refine((o) => Object.keys(o).length > 0, {
        message: 'Provide at least one field to update',
    });

async function fetchEvent(id) {
    const { data, error } = await supabase
        .from('events_with_seats')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data;
}

const notFound = (res) =>
    res.status(404).json({ error: { message: 'Event not found' } });

const mustBeFuture = (iso) => new Date(iso) > new Date();

// A malformed id is treated the same as an unknown id
router.param('id', (req, res, next, id) => {
    if (!z.string().uuid().safeParse(id).success) return notFound(res);
    next();
});

// Public: upcoming events, searchable, paginated on the server
router.get('/', async (req, res, next) => {
    try {
        const parsed = listQuery.safeParse(req.query);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);

        const { page, limit, search } = parsed.data;
        const from = (page - 1) * limit;

        let query = supabase
            .from('events_with_seats')
            .select('*', { count: 'exact' })
            .gte('starts_at', new Date().toISOString())
            .order('starts_at', { ascending: true })
            .range(from, from + limit - 1);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data, count, error } = await query;
        if (error?.code === 'PGRST103') {
            return res.status(404).json({ error: { message: 'Page not found' } });
        }
        if (error) throw error;

        res.json({
            events: data,
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit),
        });
    } catch (err) {
        next(err);
    }
});

// Public: one event
router.get('/:id', async (req, res, next) => {
    try {
        const event = await fetchEvent(req.params.id);
        if (!event) return notFound(res);
        res.json({ event });
    } catch (err) {
        next(err);
    }
});

// Admin: create
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const parsed = eventSchema.safeParse(req.body);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);
        if (!mustBeFuture(parsed.data.starts_at)) {
            return res
                .status(400)
                .json({ error: { message: 'starts_at: must be in the future' } });
        }

        const { data, error } = await supabase
            .from('events')
            .insert(parsed.data)
            .select('id')
            .single();
        if (error) throw error;

        res.status(201).json({ event: await fetchEvent(data.id) });
    } catch (err) {
        next(err);
    }
});

// Admin: edit (rule 5: seats can't go below what is already booked)
router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);
        const updates = parsed.data;

        const event = await fetchEvent(req.params.id);
        if (!event) return notFound(res);

        if (updates.starts_at && !mustBeFuture(updates.starts_at)) {
            return res
                .status(400)
                .json({ error: { message: 'starts_at: must be in the future' } });
        }

        const booked = event.total_seats - event.seats_left;
        if (updates.total_seats !== undefined && updates.total_seats < booked) {
            return res.status(409).json({
                error: { message: `Cannot reduce seats below ${booked}: already booked` },
            });
        }

        const { error } = await supabase
            .from('events')
            .update(updates)
            .eq('id', event.id);
        if (error) throw error;

        res.json({ event: await fetchEvent(event.id) });
    } catch (err) {
        next(err);
    }
});

// Admin: delete (my decision: blocked while anyone holds an active booking)
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const event = await fetchEvent(req.params.id);
        if (!event) return notFound(res);

        const booked = event.total_seats - event.seats_left;
        if (booked > 0) {
            return res.status(409).json({
                error: {
                    message: `Cannot delete: ${booked} active booking(s). Cancel them first.`,
                },
            });
        }

        const { error } = await supabase.from('events').delete().eq('id', event.id);
        if (error) throw error;
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

// Admin: who has booked this event
router.get('/:id/bookings', requireAuth, requireAdmin, async (req, res, next) => {
    try {
        const event = await fetchEvent(req.params.id);
        if (!event) return notFound(res);

        const { data, error } = await supabase
            .from('bookings')
            .select('id, created_at, user:users(id, name, email)')
            .eq('event_id', event.id)
            .eq('status', 'booked')
            .order('created_at', { ascending: true });
        if (error) throw error;

        res.json({ event: { id: event.id, title: event.title }, attendees: data });
    } catch (err) {
        next(err);
    }
});

export default router;