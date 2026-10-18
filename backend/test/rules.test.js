import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { supabase } from '../src/db.js';

let server, base, adminToken, userToken, otherToken, eventId, pastEventId, bookingId;

async function call(method, path, token, body) {
    const res = await fetch(base + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
}

async function registerFresh() {
    const email = `t${Date.now()}${Math.random().toString(36).slice(2, 8)}@test.dev`;
    const r = await call('POST', '/api/auth/register', null, {
        name: 'Test Person',
        email,
        password: 'password123',
    });
    return r.body.token;
}

before(async () => {
    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    base = `http://localhost:${server.address().port}`;

    const login = await call('POST', '/api/auth/login', null, {
        email: 'admin@eventbook.test',
        password: 'Admin@12345',
    });
    adminToken = login.body.token;
    userToken = await registerFresh();
    otherToken = await registerFresh();

    // One-seat future event made through the real admin API
    const created = await call('POST', '/api/events', adminToken, {
        title: 'Test Event (auto)',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        venue: 'Test Hall',
        total_seats: 1,
    });
    eventId = created.body.event.id;

    // The API refuses past events, so this one goes straight into the database
    const { data } = await supabase
        .from('events')
        .insert({
            title: 'Test Past Event (auto)',
            starts_at: new Date(Date.now() - 86400000).toISOString(),
            venue: 'Test Hall',
            total_seats: 5,
        })
        .select('id')
        .single();
    pastEventId = data.id;
});

after(async () => {
    await supabase.from('events').delete().in('id', [eventId, pastEventId]);
    await supabase.from('users').delete().like('email', 't%@test.dev');
    server.close();
});

test('login is required to book, and normal users cannot use admin routes', async () => {
    const anon = await call('POST', '/api/bookings', null, { event_id: eventId });
    assert.equal(anon.status, 401);

    const create = await call('POST', '/api/events', userToken, { title: 'Hack' });
    assert.equal(create.status, 403);

    const attendees = await call('GET', `/api/events/${eventId}/bookings`, userToken);
    assert.equal(attendees.status, 403);
});

test('a user can book once, but not twice', async () => {
    const first = await call('POST', '/api/bookings', userToken, { event_id: eventId });
    assert.equal(first.status, 201);
    bookingId = first.body.booking.id;

    const second = await call('POST', '/api/bookings', userToken, { event_id: eventId });
    assert.equal(second.status, 409);
    assert.match(second.body.error.message, /already booked/);
});

test('a full event cannot be overbooked', async () => {
    const res = await call('POST', '/api/bookings', otherToken, { event_id: eventId });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /full/);
});

test('a past event cannot be booked', async () => {
    const res = await call('POST', '/api/bookings', userToken, { event_id: pastEventId });
    assert.equal(res.status, 409);
});

test('only the owner can cancel, and cancelling frees the seat', async () => {
    const stranger = await call('DELETE', `/api/bookings/${bookingId}`, otherToken);
    assert.equal(stranger.status, 403);

    const owner = await call('DELETE', `/api/bookings/${bookingId}`, userToken);
    assert.equal(owner.status, 200);

    const rebook = await call('POST', '/api/bookings', otherToken, { event_id: eventId });
    assert.equal(rebook.status, 201);
});