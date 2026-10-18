import { Suspense } from 'react';
import EventDetail from './EventDetail';

export default function EventPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-line/60" />}>
      <EventDetail />
    </Suspense>
  );
}