'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { EventItem, EventList } from '@/lib/types';

type Attendee = {
  id: string;
  created_at: string;
  user: { id: string; name: string; email: string };
};

function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event?: EventItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [venue, setVenue] = useState(event?.venue ?? '');
  const [startsAt, setStartsAt] = useState(
    event ? new Date(event.starts_at).toISOString().slice(0, 16) : '',
  );
  const [totalSeats, setTotalSeats] = useState(event?.total_seats ?? 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PUT' : 'POST',
        body: JSON.stringify({ title, venue, starts_at: startsAt, total_seats: totalSeats }),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 space-y-4 p-5">
      <label className="block text-sm font-medium">
        Title
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2" />
      </label>
      <label className="block text-sm font-medium">
        Venue
        <input required value={venue} onChange={(e) => setVenue(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2" />
      </label>
      <label className="block text-sm font-medium">
        Start time
        <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 w-full rounded-lg border border-line p-2" />
      </label>
      <label className="block text-sm font-medium">
        Total seats
        <input required min={1} type="number" value={totalSeats} onChange={(e) => setTotalSeats(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-line p-2" />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save event'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminPage() {
  const { user, ready } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState<EventList | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [formState, setFormState] = useState<{ event?: EventItem } | null>(null);
  const [attendeesFor, setAttendeesFor] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const load = useCallback(async () => {
    try {
      setData(await api<EventList>(`/api/events?page=${page}&limit=10`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [page]);

  useEffect(() => {
    if (!ready) return;
    if (!isAdmin) {
      router.replace('/');
      return;
    }
    load();
  }, [ready, isAdmin, router, load]);

  async function toggleAttendees(id: string) {
    if (attendeesFor === id) {
      setAttendeesFor(null);
      return;
    }
    try {
      const res = await api<{ attendees: Attendee[] }>(`/api/events/${id}/bookings`);
      setAttendees(res.attendees);
      setAttendeesFor(id);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(event: EventItem) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await api(`/api/events/${event.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      // For example: "Cannot delete: 2 active booking(s). Cancel them first."
      setError((e as Error).message);
    }
  }

  function handleSaved() {
    setFormState(null);
    load();
  }

  if (!ready || !isAdmin) return null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Manage events</h1>
        {!formState && (
          <button onClick={() => setFormState({})} className="btn-primary">
            New event
          </button>
        )}
      </div>

      {formState && (
        <EventForm
          key={formState.event?.id ?? 'new'}
          event={formState.event}
          onSaved={handleSaved}
          onCancel={() => setFormState(null)}
        />
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!data && !error && <div className="h-40 animate-pulse rounded-lg bg-line/60" />}

      {data && data.events.length === 0 && (
        <div className="card p-10 text-center text-muted">
          No upcoming events. Create the first one.
        </div>
      )}

      {data && data.events.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.events.map((event) => (
              <li key={event.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold">{event.title}</p>
                    <p className="text-sm text-muted">
                      {formatDate(event.starts_at)} at {event.venue}
                    </p>
                    <p className="text-sm text-muted">
                      {event.total_seats - event.seats_left} of {event.total_seats} seats booked
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => toggleAttendees(event.id)} className="btn-secondary">
                      {attendeesFor === event.id ? 'Hide attendees' : 'Attendees'}
                    </button>
                    <button onClick={() => setFormState({ event })} className="btn-secondary">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(event)} className="btn-danger">
                      Delete
                    </button>
                  </div>
                </div>

                {attendeesFor === event.id && (
                  <div className="mt-4 border-t border-line pt-4">
                    {attendees.length === 0 ? (
                      <p className="text-sm text-muted">Nobody has booked this event yet.</p>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {attendees.map((a) => (
                          <li key={a.id}>
                            <span className="font-medium">{a.user.name}</span>{' '}
                            <span className="text-muted">({a.user.email})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center justify-between">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary">
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}