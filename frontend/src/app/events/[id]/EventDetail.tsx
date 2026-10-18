'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Booking, EventItem } from '@/lib/types';
import SeatsBar from '@/components/SeatsBar';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [booked, setBooked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    try {
      const { event } = await api<{ event: EventItem }>(`/api/events/${id}`);
      setEvent(event);
      if (user) {
        const { bookings } = await api<{ bookings: Booking[] }>('/api/bookings/mine');
        setBooked(bookings.some((b) => b.event.id === id && b.status === 'booked'));
      } else {
        setBooked(false);
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function handleBook() {
    setActionError('');
    setBooking(true);
    try {
      await api('/api/bookings', { method: 'POST', body: { event_id: id } });
    } catch (e) {
      setActionError((e as Error).message);
    }
    await load(); // refresh seats, even after a failure (the event may have just filled up)
    setBooking(false);
  }

  if (loading) return <div className="card h-64 animate-pulse bg-slate-100" />;

  if (error || !event) {
    return (
      <div className="card p-10 text-center">
        <p className="text-slate-600">{error || 'Event not found'}</p>
        <Link href="/" className="btn-secondary mt-4">
          Back to events
        </Link>
      </div>
    );
  }

  const past = new Date(event.starts_at) <= new Date();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="text-sm text-slate-500 hover:text-indigo-600">
        &larr; All events
      </Link>

      <div className="card mt-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{event.title}</h1>
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          <p>{formatDate(event.starts_at)}</p>
          <p>{event.venue}</p>
        </div>

        {event.description && (
          <p className="mt-6 whitespace-pre-line text-slate-700">{event.description}</p>
        )}

        <div className="mt-6">
          <SeatsBar total={event.total_seats} left={event.seats_left} />
        </div>

        {actionError && (
          <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </p>
        )}

        <div className="mt-6">
          {past ? (
            <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
              This event has already taken place.
            </p>
          ) : booked ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <span>You have a seat at this event.</span>
              <Link href="/bookings" className="font-medium underline">
                View my bookings
              </Link>
            </div>
          ) : event.seats_left === 0 ? (
            <button disabled className="btn-primary w-full sm:w-auto">
              Sold out
            </button>
          ) : !user ? (
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Log in to book a seat
            </Link>
          ) : (
            <button onClick={handleBook} disabled={booking} className="btn-primary w-full sm:w-auto">
              {booking ? 'Booking...' : 'Book a seat'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}