'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { EventItem } from '@/lib/types';

// datetime-local inputs want local time like "2026-10-20T14:00"
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event?: EventItem;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: event?.title ?? '',
    description: event?.description ?? '',
    starts_at: event ? toLocalInput(event.starts_at) : '',
    venue: event?.venue ?? '',
    total_seats: String(event?.total_seats ?? ''),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        starts_at: new Date(form.starts_at).toISOString(),
        venue: form.venue,
        total_seats: Number(form.total_seats),
      };
      if (event) {
        await api(`/api/events/${event.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/events', { method: 'POST', body });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 space-y-4 p-6">
      <h2 className="font-display text-xl font-semibold">
        {event ? 'Edit event' : 'New event'}
      </h2>

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          className="input"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          className="input"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Date and time</label>
          <input
            type="datetime-local"
            className="input"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Total seats</label>
          <input
            type="number"
            min={1}
            className="input"
            value={form.total_seats}
            onChange={(e) => setForm({ ...form, total_seats: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Venue</label>
        <input
          className="input"
          value={form.venue}
          onChange={(e) => setForm({ ...form, venue: e.target.value })}
          required
        />
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : event ? 'Save changes' : 'Create event'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}