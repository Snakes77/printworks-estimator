import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from '@/components/auth/login-form';
import { BRAND_CONFIG } from '@/lib/brand';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  // SECURITY: Use getUser() instead of getSession() to validate with Supabase Auth server
  if (user) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-center">
          <img 
            src={BRAND_CONFIG.logo.url} 
            alt={BRAND_CONFIG.logo.alt}
            className="h-12 w-auto"
          />
        </div>
        <h1 className="text-xl font-semibold text-brand">Sign in to {BRAND_CONFIG.name}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your work email address, and we will email you a secure magic link.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
