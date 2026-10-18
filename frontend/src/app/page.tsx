'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EventList } from '@/lib/types';
import EventCard from '@/components/EventCard';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<EventList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Wait until the user stops typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams({ page: String(page), limit: '9' });
    if (search) params.set('search', search);

    api<EventList>(`/api/events?${params}`)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [search, page, reloadKey]);

    return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">What&apos;s on</h1>
        <p className="mt-2 max-w-md text-muted">
          Browse freely. Log in when you want to book a seat.
        </p>
        <label htmlFor="search" className="sr-only">
          Search events by title
        </label>
        <input
          id="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search events by title"
          className="input mt-6 max-w-md"
        />
      </header>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <p>{error}</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary mt-3">
            Try again
          </button>
        </div>
      )}

      {loading && !error && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-line/60" />
          ))}
        </div>
      )}

      {!loading && !error && data && data.events.length === 0 && (
        <div className="card p-10 text-center">
          <p className="font-display text-lg font-semibold">
            {search ? 'No matching events' : 'No upcoming events'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {search ? `Nothing matches "${search}". Try a shorter word.` : 'Check back soon.'}
          </p>
        </div>
      )}

      {!loading && !error && data && data.events.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted">
            {data.total} upcoming {data.total === 1 ? 'event' : 'events'}
          </p>
          <div className="space-y-3">
            {data.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

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