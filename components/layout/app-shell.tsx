'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/navigation/sign-out-button';

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/quotes', label: 'Quotes' },
  { href: '/rate-cards', label: 'Rate Cards' },
  { href: '/import', label: 'Import' },
  { href: '/settings', label: 'Settings' }
];

export const AppShell = ({
  children,
  user
}: {
  children: React.ReactNode;
  user: { email: string; name?: string | null };
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className={cn(
          'fixed inset-y-0 z-40 w-64 translate-x-0 border-r border-slate-200 bg-white px-6 py-8 transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-brand">
            PrintWorks Estimator
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100',
                  active && 'bg-slate-900 text-white hover:bg-slate-900'
                )}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 pt-10 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Signed in as</p>
          <p>{user.name ?? user.email}</p>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setOpen((previous) => !previous)}>
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-base font-semibold text-slate-900">Fast, accurate print estimating</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild>
                <Link href="/quotes/new">New Quote</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10">
          {children}
        </main>
      </div>
    </div>
  );
};
