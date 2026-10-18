'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { Booking } from '@/lib/types';

export default function BookingsPage() {
    const { user, ready } = useAuth();
    const router = useRouter();
    const [bookings, setBookings] = useState<Booking[] | null>(null);
    const [error, setError] = useState('');
    const [cancelling, setCancelling] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await api<{ bookings: Booking[] }>('/api/bookings/mine');
            setBookings(data.bookings);
            setError('');
        } catch (e) {
            setError((e as Error).message);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        if (!user) {
            router.replace('/login');
            return;
        }
        load();
    }, [ready, user, router, load]);

    async function handleCancel(b: Booking) {
        if (!window.confirm(`Cancel your booking for "${b.event.title}"?`)) return;
        setCancelling(b.id);
        setError('');
        try {
            await api(`/api/bookings/${b.id}`, { method: 'DELETE' });
            await load();
        } catch (e) {
            setError((e as Error).message);
        }
        setCancelling(null);
    }

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-2xl font-bold">My bookings</h1>

            {error && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </p>
            )}

            {!bookings && !error && <div className="card h-32 animate-pulse bg-slate-100" />}

            {bookings && bookings.length === 0 && (
                <div className="card p-10 text-center text-slate-500">
                    <p>You have not booked any events yet.</p>
                    <Link href="/" className="btn-primary mt-4">
                        Browse events
                    </Link>
                </div>
            )}

            {bookings && bookings.length > 0 && (
                <ul className="space-y-3">
                    {bookings.map((b) => {
                        const past = new Date(b.event.starts_at) <= new Date();
                        return (
                            <li key={b.id} className="card flex flex-wrap items-center gap-4 p-5">
                                <div className="min-w-0 flex-1">
                                    <Link href={`/events/${b.event.id}`} className="font-semibold hover:text-indigo-600">
                                        {b.event.title}
                                    </Link>
                                    <p className="text-sm text-slate-500">{formatDate(b.event.starts_at)}</p>
                                    <p className="text-sm text-slate-500">{b.event.venue}</p>
                                </div>
                                {b.status === 'cancelled' ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                        Cancelled
                                    </span>
                                ) : past ? (
                                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                        Attended
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleCancel(b)}
                                        disabled={cancelling === b.id}
                                        className="btn-danger"
                                    >
                                        {cancelling === b.id ? 'Cancelling...' : 'Cancel booking'}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}