import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import Navbar from '@/components/Navbar';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' });
const body = Figtree({ subsets: ['latin'], variable: '--font-figtree' });

export const metadata: Metadata = {
  title: 'EventBook',
  description: 'Browse and book events',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen font-sans`}>
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}