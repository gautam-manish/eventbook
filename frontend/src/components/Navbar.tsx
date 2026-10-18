'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <nav className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold tracking-tight">
          EventBook<span className="text-marigold">.</span>
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
          {ready && user ? (
            <>
              <Link href="/bookings" className="hover:text-brand">
                My bookings
              </Link>
              {user.role === 'admin' && (
                <Link href="/admin" className="hover:text-brand">
                  Admin
                </Link>
              )}
              <span className="text-muted">{user.name}</span>
              <button onClick={handleLogout} className="btn-secondary !px-3 !py-1.5">
                Log out
              </button>
            </>
          ) : (
            ready && (
              <>
                <Link href="/login" className="hover:text-brand">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary !py-1.5">
                  Register
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </nav>
  );
}