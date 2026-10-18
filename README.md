# EventBook

A small event booking app. Visitors browse events without logging in, registered users book and cancel seats, and an admin manages events and sees who has booked.

## Live links and test accounts

- App: https://eventbook-iota-tawny.vercel.app
- API: https://eventbook-8mxe.onrender.com

| Role  | Email                | Password    |
|-------|----------------------|-------------|
| Admin | admin@eventbook.test | Admin@12345 |
| User  | user@eventbook.test  | User@12345  |
| User  | other@eventbook.test | Other@12345 |

The API runs on Render's free plan, which sleeps when idle. The first request after a quiet period can take up to a minute; after that it is fast.

The seed data includes a past event, a nearly full event ("Nearly Full: Design Workshop", one seat left), a sold-out event ("Sold Out: Jazz Night") and enough other events to test pagination and search.

## Tech stack and why

| Layer      | Choice                                         | Why |
|------------|------------------------------------------------|-----|
| Frontend   | Next.js (App Router), TypeScript, Tailwind CSS | Required by the brief. Used for the UI only: it calls the REST API and never touches the database. |
| Backend    | Node.js + Express                              | The preferred option in the brief, and it lets me use one language across the whole project. |
| Database   | Supabase (PostgreSQL)                          | Required by the brief. Only the backend connects to it, using the secret key. |
| Auth       | Built by hand with bcrypt and JWT              | The brief asks for custom auth instead of Supabase Auth. |
| Validation | zod                                            | One schema per endpoint, with clear error messages. |
| Tests      | Node's built-in test runner                    | No extra dependency for a small suite. |

## Running locally

Requirements: Node.js 20 or newer, and a Supabase project with the tables from the schema at the bottom of this file.

**Backend**

```bash
cd backend
cp .env.example .env      # then fill in the values
npm install
npm run seed              # creates the 3 accounts and the sample events
npm run dev               # http://localhost:4000
```

Backend environment variables (`backend/.env.example`):

| Variable              | Meaning |
|-----------------------|---------|
| `PORT`                | Port for the API (default 4000) |
| `SUPABASE_URL`        | Project URL, for example `https://xxxx.supabase.co` (no path, no trailing slash) |
| `SUPABASE_SECRET_KEY` | Supabase secret key. Backend only, never in the frontend. |
| `JWT_SECRET`          | Long random string used to sign tokens |
| `CLIENT_ORIGIN`       | Exact frontend origin allowed by CORS, for example `http://localhost:3000` |

**Frontend**

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

Frontend environment variable: `NEXT_PUBLIC_API_URL`, the base URL of the API (for example `http://localhost:4000`).

**Seed command:** `npm run seed` (in `backend`). It upserts the three accounts and **deletes and recreates all events**, so it is for demo data only.

**Test command:** `npm test` (in `backend`).

The tests call the real API and the real database. They create their own temporary event and users and delete them afterwards. They need the seeded admin account to exist. They cover: login required to book, normal users rejected on admin routes, no double booking, no overbooking, no booking of past events, and only the owner being able to cancel.

## Data model

Three tables and one view.

- `users`: id, name, email (unique), password_hash, role (`user` or `admin`), created_at
- `events`: id, title, description, starts_at, venue, total_seats, created_at
- `bookings`: id, user_id, event_id, status (`booked` or `cancelled`), created_at, cancelled_at
- `events_with_seats` (view): every event plus a calculated `seats_left`

Why it looks like this:

- **Seats left is calculated, not stored.** The view counts bookings with status `booked` for each event, so there is no counter that can drift out of sync with the real bookings.
- **Cancelling keeps the row.** A cancelled booking gets status `cancelled`, which frees the seat and keeps history.
- **One active booking per user per event** is enforced by a partial unique index on `(user_id, event_id) where status = 'booked'`. A user can book again after cancelling, but cannot hold two active bookings, even if someone calls the API directly.
- **Row level security is enabled on all tables with no policies.** The public Supabase API cannot read them; only the backend, using the secret key, can.

## API

Errors always have the same shape, `{ "error": { "message": "..." } }`, with proper status codes (400 invalid input, 401 not logged in, 403 not allowed, 404 not found, 409 conflict with a rule). Unexpected errors return a generic 500 message and are logged on the server only, so stack traces never reach the client.

**Public**

| Method | Route                              | Purpose |
|--------|------------------------------------|---------|
| POST   | `/api/auth/register`               | Create a normal user account, returns a token |
| POST   | `/api/auth/login`                  | Log in, returns a token |
| GET    | `/api/events?page=&limit=&search=` | Upcoming events, paginated on the server, searchable by title |
| GET    | `/api/events/:id`                  | One event with seats left |
| GET    | `/health`                          | Health check |

**Logged-in users** (header `Authorization: Bearer <token>`)

| Method | Route                | Purpose |
|--------|----------------------|---------|
| POST   | `/api/bookings`      | Book one seat (`{ "event_id": "..." }`) |
| GET    | `/api/bookings/mine` | My bookings, newest first |
| DELETE | `/api/bookings/:id`  | Cancel my own booking |

**Admin only**

| Method | Route                      | Purpose |
|--------|----------------------------|---------|
| POST   | `/api/events`              | Create an event |
| PATCH  | `/api/events/:id`          | Edit an event |
| DELETE | `/api/events/:id`          | Delete an event |
| GET    | `/api/events/:id/bookings` | List who has booked an event |

## Decisions and trade-offs

**The six rules are enforced in the backend.** The frontend hides buttons for convenience, but every rule is checked on the server, so calling the API with Postman or curl hits the same checks.

1. *No double booking.* Rejected with 409. Backed by the partial unique index in the database, not only by code.
2. *No overbooking.* A booking is inserted first. The backend then lists the active bookings for the event in creation order. If the new booking falls beyond `total_seats`, it is deleted again and the user gets "This event is full" (409). Two people racing for the last seat cannot both succeed.
3. *Past events.* Booking and cancelling are both rejected with 409 once the event has started.
4. *Cancelling.* Only the owner can cancel (403 for anyone else), and cancelling frees the seat.
5. *Reducing seats.* An admin cannot set `total_seats` below the number already booked (409, with the number in the message).
6. *Admin only.* Event management and attendee lists sit behind `requireAuth` followed by `requireAdmin`, which reads the role from the verified token.

**Admin accounts only come from the seed script.** Registration always creates a normal user, and the role is never read from the request body.

**Deleting an event that has bookings is blocked.** The API returns 409 with the number of active bookings. I chose this so nobody silently loses a seat they booked: the admin has to deal with the bookings first. Events with no active bookings can be deleted, and any cancelled history is removed with them.

**Other edge cases handled:**

- Malformed ids return 404, an invalid or expired token returns 401, and an out-of-range page returns 404.
- Emails are lower-cased, so `A@x.com` and `a@x.com` are the same account.
- Login gives the same message for a wrong email and a wrong password, so it does not reveal which emails exist.
- Passwords are hashed with bcrypt (cost 10) and never returned by the API.

**Logout** just deletes the token in the browser, because a JWT is stateless. A token stays valid until it expires (7 days).

**Token storage.** The token is kept in `localStorage`. This is simple, but injected scripts could read it. A production app would use httpOnly cookies.

## AI usage

I used Claude as a guide throughout this project: for the data model and SQL, the Express routes, the Next.js pages, the UI design, debugging error messages, and the deployment steps. I built it step by step, ran each piece, and fixed the problems that came up along the way. For example, a wrong Supabase URL in my `.env` broke the first API calls, a database function was not found in Supabase so I moved the booking logic into the API, and the deployed backend rejected the frontend until I corrected the CORS origin. I am a beginner, and I used AI heavily to learn while building, so I have tried to understand each file and can walk through how it works.

## Known issues and next steps

- **The overbooking check is not one atomic database operation.** The insert-then-check approach is safe against overbooking, but in a very tight race someone could be told "full" even though a seat was freed a moment later. Next step: a Postgres function that locks the event row (`select ... for update`) and does the whole booking in one transaction.
- **No rate limiting on login.** Next step: `express-rate-limit` on the auth routes.
- **No Docker Compose.**
- **The admin list shows upcoming events only,** because it reuses the public list endpoint. A past-events view would need an admin-specific endpoint.
- **Tests run against the live Supabase project** and rely on the seeded admin. A separate test database would be better.
- **Token in `localStorage`,** and no way to revoke a token before it expires.
- **No password reset or email verification.**
- **Cold start.** The free Render backend sleeps when idle.

## Appendix: database schema

Run this in the Supabase SQL editor.

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  venue text not null,
  total_seats integer not null check (total_seats > 0),
  created_at timestamptz not null default now()
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  event_id uuid not null references events(id) on delete cascade,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- One active booking per user per event
create unique index one_active_booking_per_user_event
  on bookings (user_id, event_id) where status = 'booked';

-- Seats left is calculated from active bookings
create view events_with_seats with (security_invoker = true) as
select
  e.id, e.title, e.description, e.starts_at, e.venue, e.total_seats, e.created_at,
  e.total_seats - (count(b.id) filter (where b.status = 'booked'))::int as seats_left
from events e
left join bookings b on b.event_id = e.id
group by e.id;

-- Only the backend (secret key) can access the tables
alter table users enable row level security;
alter table events enable row level security;
alter table bookings enable row level security;
```