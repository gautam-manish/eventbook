import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { supabase } from './db.js';

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d) => {
  const t = new Date(Date.now() + d * DAY);
  t.setUTCHours(12, 0, 0, 0);
  return t.toISOString();
};

async function upsertUser(name, email, password, role) {
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('users')
    .upsert({ name, email, password_hash, role }, { onConflict: 'email' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function main() {
  await upsertUser('Admin', 'admin@eventbook.test', 'Admin@12345', 'admin');
  const userId = await upsertUser('Demo User', 'user@eventbook.test', 'User@12345', 'user');
  const otherId = await upsertUser('Other Attendee', 'other@eventbook.test', 'Other@12345', 'user');

  // Reset demo events (bookings go with them via ON DELETE CASCADE)
  const { error: delError } = await supabase.from('events').delete().not('id', 'is', null);
  if (delError) throw delError;

  const venues = ['Patan Durbar Hall', 'Kathmandu Tech Hub', 'Pokhara Lakeside Arena', 'Bhaktapur Community Centre'];
  const kinds = ['Workshop', 'Meetup', 'Concert', 'Talk'];

  const special = [
    { title: 'Past Event: Intro to React', description: 'Already happened, used to test the past-event rules.', starts_at: daysFromNow(-7), venue: venues[0], total_seats: 30 },
    { title: 'Nearly Full: Design Workshop', description: 'One seat left.', starts_at: daysFromNow(10), venue: venues[1], total_seats: 2 },
    { title: 'Sold Out: Jazz Night', description: 'No seats left.', starts_at: daysFromNow(12), venue: venues[2], total_seats: 1 },
  ];
  const filler = Array.from({ length: 25 }, (_, i) => ({
    title: `${kinds[i % 4]} #${i + 1}`,
    description: `Sample ${kinds[i % 4].toLowerCase()} for testing search and pagination.`,
    starts_at: daysFromNow(i + 3),
    venue: venues[i % 4],
    total_seats: 20 + i,
  }));

  const { data: events, error: evError } = await supabase
    .from('events')
    .insert([...special, ...filler])
    .select('id, title');
  if (evError) throw evError;

  const idOf = (title) => events.find((e) => e.title === title).id;
  const { error: bkError } = await supabase.from('bookings').insert([
    { user_id: userId, event_id: idOf('Past Event: Intro to React') },
    { user_id: otherId, event_id: idOf('Nearly Full: Design Workshop') },
    { user_id: otherId, event_id: idOf('Sold Out: Jazz Night') },
  ]);
  if (bkError) throw bkError;

  console.log('Seeded 3 users and', events.length, 'events');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});