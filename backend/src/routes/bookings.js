import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validationError } from '../utils.js';

const router = Router();
router.use(requireAuth);

const bookSchema = z.object({ event_id: z.string().uuid() });

const BOOK_ERRORS = {
    not_found: [404, 'Event not found'],
    past: [409, 'This event has already started'],
    duplicate: [409, 'You have already booked this event'],
    full: [409, 'This event is full'],
};

const CANCEL_ERRORS = {
    not_found: [404, 'Booking not found'],
    forbidden: [403, 'You can only cancel your own bookings'],
    already_cancelled: [409, 'This booking is already cancelled'],
    past: [409, 'Bookings for past events cannot be cancelled'],
};

// Book one seat
router.post('/', async (req, res, next) => {
    try {
        const parsed = bookSchema.safeParse(req.body);
        if (!parsed.success) return validationError(res, parsed.error.issues[0]);

        const { data, error } = await supabase.rpc('book_seat', {
            p_user_id: req.user.id,
            p_event_id: parsed.data.event_id,
        });
        if (error) throw error;

        const { out_result, out_booking_id } = data[0];
        if (out_result !== 'ok') {
            const [status, message] = BOOK_ERRORS[out_result];
            return res.status(status).json({ error: { message } });
        }
        res.status(201).json({
            booking: { id: out_booking_id, event_id: parsed.data.event_id, status: 'booked' },
        });
    } catch (err) {
        next(err);
    }
});

// My bookings (newest first)
router.get('/mine', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('bookings')
            .select('id, status, created_at, cancelled_at, event:events(id, title, starts_at, venue)')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json({ bookings: data });
    } catch (err) {
        next(err);
    }
});

// Cancel one of my bookings (kept as history, seat is freed)
router.delete('/:id', async (req, res, next) => {
    try {
        if (!z.string().uuid().safeParse(req.params.id).success) {
            return res.status(404).json({ error: { message: 'Booking not found' } });
        }

        const { data: result, error } = await supabase.rpc('cancel_booking', {
            p_user_id: req.user.id,
            p_booking_id: req.params.id,
        });
        if (error) throw error;

        if (result !== 'ok') {
            const [status, message] = CANCEL_ERRORS[result];
            return res.status(status).json({ error: { message } });
        }
        res.json({ booking: { id: req.params.id, status: 'cancelled' } });
    } catch (err) {
        next(err);
    }
});

export default router;