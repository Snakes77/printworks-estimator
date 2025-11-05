import './globals.css';
import { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppProviders } from '@/components/providers/app-providers';
import { Toaster } from '@/components/ui/toaster';
import { BRAND_CONFIG } from '@/lib/brand';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: BRAND_CONFIG.metadata.title,
  description: BRAND_CONFIG.metadata.description,
  icons: {
    icon: '/favicon.ico',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // SECURITY: Use getUser() instead of getSession() to validate with Supabase Auth server
  // Note: initialSession is not actually used in SupabaseProvider (it's ignored),
  // so we can safely pass null to avoid the getSession() warning
  // The browser client will handle session management client-side

  return (
    <html lang="en-GB">
      <body className={`${inter.className} bg-slate-100`}>
        <AppProviders initialSession={null}>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
