'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const schema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6).optional()
});

type FormValues = z.infer<typeof schema>;

export const LoginForm = () => {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [loading, setLoading] = useState(false);
  const [usePassword, setUsePassword] = useState(false);

  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true);

      if (usePassword && values.password) {
        // Try password sign in first
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password
        });

        // If user doesn't exist, create account
        if (error?.message?.includes('Invalid login credentials')) {
          const signUpResult = await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`
            }
          });

          if (signUpResult.error) {
            throw signUpResult.error;
          }

          toast.success('Account created! Signing you in...');
        } else if (error) {
          throw error;
        }

        router.push('/');
        router.refresh();
      } else {
        // Magic link flow
        const { error } = await supabase.auth.signInWithOtp({
          email: values.email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });

        if (error) {
          throw error;
        }

        toast.success('Magic link sent. Please check your inbox.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input id="email" type="email" autoComplete="email" disabled={loading} {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>

      {usePassword && (
        <div className="space-y-2">
          <Label htmlFor="password">Password (dev only)</Label>
          <Input id="password" type="password" autoComplete="current-password" disabled={loading} {...register('password')} />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (usePassword ? 'Signing in…' : 'Sending magic link…') : (usePassword ? 'Sign in with password' : 'Email magic link')}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full text-xs"
        onClick={() => setUsePassword(!usePassword)}
      >
        {usePassword ? 'Use magic link instead' : 'Use password (dev mode)'}
      </Button>
    </form>
  );
};
