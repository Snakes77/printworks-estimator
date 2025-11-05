import { z } from 'zod';

/**
 * SECURITY: Environment variable validation at build time
 * Prevents deployment with missing or invalid configuration
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'Supabase anon key too short'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'Supabase service role key too short'),
  SUPABASE_DB_URL: z.string().url('Invalid database URL'),
  NEXT_PUBLIC_SITE_URL: z.string().url('Invalid site URL').optional(),
  UPSTASH_REDIS_REST_URL: z.string().url('Invalid Upstash Redis URL').optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(20).optional(),
  RESEND_API_KEY: z.string().min(20, 'Resend API key too short').optional(),
  RESEND_FROM_EMAIL: z.string().email('Invalid Resend from email').optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables
 * Throws error if any required variables are missing or invalid
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Invalid environment variables:\n${missing}`);
    }
    throw error;
  }
}

// Validate on module load (development/build time)
if (typeof window === 'undefined') {
  try {
    validateEnv();
  } catch (error) {
    // Only throw in production builds
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    // Warn in development
    console.warn('Environment validation warning:', error);
  }
}

