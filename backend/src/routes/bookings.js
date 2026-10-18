import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validationError } from '../utils.js';

const router = Router();
router.use(requireAuth);

const bookSchema = z.object({ event_id: z.string().uuid() });
const fail = (res, status, message) =>
  res.status(status).json({ error: { message } });

// Book one seat
router.post('/', async (req, res, next) => {
  try {
    const parsed = bookSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues[0]);
    const eventId = parsed.data.event_id;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, starts_at, total_seats')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return fail(res, 404, 'Event not found');
    if (new Date(event.starts_at) <= new Date()) {
      return fail(res, 409, 'This event has already started');
    }

    // The unique index in the database rejects a second active booking by the same user
    const { data: booking, error: insertError } = await supabase
      .from('bookings')
      .insert({ user_id: req.user.id, event_id: eventId })
      .select('id')
      .single();
    if (insertError) {
      if (insertError.code === '23505') {
        return fail(res, 409, 'You have already booked this event');
      }
      throw insertError;
    }

    // Seats go to bookings in the order they were made. If ours falls beyond
    // the capacity, undo it, so the event can never end up overbooked.
    const { data: active, error: listError } = await supabase
      .from('bookings')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'booked')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (listError) throw listError;

    const position = active.findIndex((b) => b.id === booking.id);
    if (position >= event.total_seats) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      return fail(res, 409, 'This event is full');
    }

    res.status(201).json({
      booking: { id: booking.id, event_id: eventId, status: 'booked' },
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

// Cancel one of my bookings (kept as history, the seat is freed)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) {
      return fail(res, 404, 'Booking not found');
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, user_id, status, event:events(starts_at)')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;

    if (!booking) return fail(res, 404, 'Booking not found');
    if (booking.user_id !== req.user.id) {
      return fail(res, 403, 'You can only cancel your own bookings');
    }
    if (booking.status === 'cancelled') {
      return fail(res, 409, 'This booking is already cancelled');
    }
    if (new Date(booking.event.starts_at) <= new Date()) {
      return fail(res, 409, 'Bookings for past events cannot be cancelled');
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('status', 'booked');
    if (updateError) throw updateError;

    res.json({ booking: { id: booking.id, status: 'cancelled' } });
  } catch (err) {
    next(err);
  }
});

export default router;