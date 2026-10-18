-- ============================================================
-- book_seat: atomically check rules and insert a booking
-- Returns a single row with (out_result, out_booking_id)
-- out_result is one of: 'ok', 'not_found', 'past', 'duplicate', 'full'
-- ============================================================
CREATE OR REPLACE FUNCTION public.book_seat(
    p_user_id  UUID,
    p_event_id UUID
)
RETURNS TABLE(out_result TEXT, out_booking_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event    RECORD;
    v_booked   INT;
    v_existing UUID;
    v_new_id   UUID;
BEGIN
    -- Lock the event row to prevent race conditions
    SELECT id, starts_at, total_seats
      INTO v_event
      FROM public.events
     WHERE id = p_event_id
       FOR UPDATE;

    IF NOT FOUND THEN
        out_result := 'not_found';
        out_booking_id := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Past event?
    IF v_event.starts_at <= NOW() THEN
        out_result := 'past';
        out_booking_id := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Already booked by this user?
    SELECT id INTO v_existing
      FROM public.bookings
     WHERE user_id  = p_user_id
       AND event_id = p_event_id
       AND status   = 'booked';

    IF FOUND THEN
        out_result := 'duplicate';
        out_booking_id := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Seats full?
    SELECT COUNT(*) INTO v_booked
      FROM public.bookings
     WHERE event_id = p_event_id
       AND status   = 'booked';

    IF v_booked >= v_event.total_seats THEN
        out_result := 'full';
        out_booking_id := NULL;
        RETURN NEXT;
        RETURN;
    END IF;

    -- All good — insert the booking
    INSERT INTO public.bookings (user_id, event_id, status)
    VALUES (p_user_id, p_event_id, 'booked')
    RETURNING id INTO v_new_id;

    out_result := 'ok';
    out_booking_id := v_new_id;
    RETURN NEXT;
END;
$$;


-- ============================================================
-- cancel_booking: mark a booking as cancelled, freeing the seat
-- Returns a TEXT result: 'ok', 'not_found', 'forbidden',
--                        'already_cancelled', 'past'
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_user_id    UUID,
    p_booking_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
BEGIN
    SELECT b.id, b.user_id, b.status, e.starts_at
      INTO v_booking
      FROM public.bookings b
      JOIN public.events   e ON e.id = b.event_id
     WHERE b.id = p_booking_id
       FOR UPDATE OF b;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF v_booking.user_id <> p_user_id THEN
        RETURN 'forbidden';
    END IF;

    IF v_booking.status = 'cancelled' THEN
        RETURN 'already_cancelled';
    END IF;

    IF v_booking.starts_at <= NOW() THEN
        RETURN 'past';
    END IF;

    UPDATE public.bookings
       SET status       = 'cancelled',
           cancelled_at = NOW()
     WHERE id = p_booking_id;

    RETURN 'ok';
END;
$$;
