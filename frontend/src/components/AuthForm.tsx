'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { User } from '@/lib/types';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = isRegister
        ? form
        : { email: form.email, password: form.password };
      const data = await api<{ user: User; token: string }>(`/api/auth/${mode}`, {
        method: 'POST',
        body,
      });
      login(data.user, data.token);
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="card mx-auto mt-6 max-w-md p-8">
      <h1 className="text-2xl font-bold">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isRegister ? 'Register to book seats at events.' : 'Log in to manage your bookings.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {isRegister && (
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Password</label>
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {isRegister && <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-indigo-600 hover:underline"
        >
          {isRegister ? 'Log in' : 'Create an account'}
        </Link>
      </p>
    </div>
  );
}