import './globals.css';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppProviders } from '@/components/providers/app-providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PrintWorks Estimator',
  description: 'Fast, accurate quoting for commercial print in one place.'
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-100`}>
        <AppProviders initialSession={session}>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
