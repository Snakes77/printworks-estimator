'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignOutButton } from '@/components/navigation/sign-out-button';
import { BRAND_CONFIG } from '@/lib/brand';

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
    <div className="flex min-h-screen bg-slate-100 print:hidden">
      <aside
        className={cn(
          'fixed inset-y-0 z-40 w-64 translate-x-0 border-r border-slate-200 bg-white px-6 py-8 transition-transform lg:static lg:translate-x-0 print:hidden',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={BRAND_CONFIG.logo.url}
              alt={BRAND_CONFIG.logo.alt}
              width={BRAND_CONFIG.logo.width}
              height={BRAND_CONFIG.logo.height}
              className="h-10 w-auto"
              priority
            />
          </Link>
          <button 
            className="lg:hidden text-slate-600 hover:text-slate-900" 
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
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
                  'block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors',
                  active && 'bg-brand text-white hover:bg-brand-muted'
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

      <div className="flex flex-1 flex-col lg:ml-64 print:w-full print:ml-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <button 
                className="lg:hidden text-slate-600 hover:text-slate-900 print:hidden" 
                onClick={() => setOpen((previous) => !previous)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-base font-semibold text-brand">{BRAND_CONFIG.shortTagline}</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild className="print:hidden">
                <Link href="/quotes/new">New Quote</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-10 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>
      </div>
    </div>
  );
};
