import Link from 'next/link';
import { EventItem } from '@/lib/types';
import { dateParts, formatTime } from '@/lib/format';

function SeatsTag({ left, total }: { left: number; total: number }) {
  if (left === 0) {
    return <span className="text-sm font-semibold text-danger">Sold out</span>;
  }
  const low = left <= Math.max(2, total * 0.15);
  return (
    <span className={`text-sm font-semibold ${low ? 'text-amber-700' : 'text-brand'}`}>
      {low ? `Only ${left} left` : `${left} seats left`}
    </span>
  );
}

export default function EventCard({ event }: { event: EventItem }) {
  const { month, day } = dateParts(event.starts_at);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex overflow-hidden rounded-lg border border-line bg-white transition-colors hover:border-ink"
    >
      <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r-2 border-dashed border-line bg-marigold/25 py-4 sm:w-24">
        <span className="font-display text-3xl font-bold leading-none sm:text-4xl">{day}</span>
        <span className="mt-1 text-sm font-medium">{month}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold group-hover:underline">
            {event.title}
          </h2>
          <p className="truncate text-sm text-muted">
            {formatTime(event.starts_at)} at {event.venue}
          </p>
        </div>
        <SeatsTag left={event.seats_left} total={event.total_seats} />
      </div>
    </Link>
  );
}