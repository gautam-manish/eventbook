export type User = {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
};

export type EventItem = {
    id: string;
    title: string;
    description: string;
    starts_at: string;
    venue: string;
    total_seats: number;
    seats_left: number;
};

export type EventList = {
    events: EventItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};
export type Booking = {
    id: string;
    status: 'booked' | 'cancelled';
    created_at: string;
    cancelled_at: string | null;
    event: { id: string; title: string; starts_at: string; venue: string };
};