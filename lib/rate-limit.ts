import { TRPCError } from '@trpc/server';

/**
 * SECURITY: Rate limiting for expensive operations
 * 
 * PRODUCTION: Uses Upstash Redis for distributed rate limiting
 * FALLBACK: Uses in-memory rate limiting if Upstash not configured
 */

// Check if Upstash Redis is configured
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * In-memory rate limiter (fallback for development)
 */
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();

  async check(identifier: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const recentRequests = userRequests.filter(time => now - time < windowMs);
    
    if (recentRequests.length >= limit) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);
    
    return true;
  }

  getRetryAfter(identifier: string, windowMs: number): number {
    const userRequests = this.requests.get(identifier) || [];
    if (userRequests.length === 0) return 0;
    
    const oldestRequest = Math.min(...userRequests);
    const retryAfter = windowMs - (Date.now() - oldestRequest);
    return Math.max(0, Math.ceil(retryAfter / 1000));
  }
}

/**
 * Upstash Redis rate limiter (production)
 */
class UpstashRateLimiter {
  private redisUrl: string;
  private redisToken: string;

  constructor(url: string, token: string) {
    this.redisUrl = url;
    this.redisToken = token;
  }

  async check(identifier: string, limit: number, windowMs: number): Promise<boolean> {
    const windowSeconds = Math.floor(windowMs / 1000);
    const key = `ratelimit:${identifier}:${windowSeconds}`;
    const now = Date.now();
    
    try {
      // Use Upstash REST API
      const response = await fetch(`${this.redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([
          ['ZREMRANGEBYSCORE', key, 0, now - windowMs],
          ['ZCARD', key],
          ['ZADD', key, now, `${now}-${Math.random()}`],
          ['EXPIRE', key, windowSeconds]
        ])
      });

      if (!response.ok) {
        console.error('Upstash rate limit check failed:', response.statusText);
        // Fallback to allowing the request in case of Redis failure
        return true;
      }

      const results = await response.json();
      const currentCount = results[1]?.result || 0;
      
      return currentCount < limit;
    } catch (error) {
      console.error('Rate limit check error:', error);
      // Fail open - allow request if Redis is down
      return true;
    }
  }

  getRetryAfter(identifier: string, windowMs: number): number {
    // For Upstash, return window duration
    return Math.ceil(windowMs / 1000);
  }
}

// Initialize rate limiter based on environment
let rateLimiter: InMemoryRateLimiter | UpstashRateLimiter;

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  // Production: Use Upstash Redis
  rateLimiter = new UpstashRateLimiter(UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN);
} else {
  // Development/Fallback: Use in-memory
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️  Upstash Redis not configured. Using in-memory rate limiting (not recommended for production).');
  }
  rateLimiter = new InMemoryRateLimiter();
}

/**
 * Rate limit configurations for different operations
 */
export const RATE_LIMITS = {
  PDF_GENERATION: { limit: 10, windowMs: 60 * 1000 }, // 10 per minute
  CSV_IMPORT: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  QUOTE_CREATE: { limit: 50, windowMs: 60 * 60 * 1000 }, // 50 per hour
  DEFAULT: { limit: 100, windowMs: 60 * 1000 } // 100 per minute for general operations
} as const;

/**
 * Create rate limit middleware for tRPC procedures
 */
export async function checkRateLimit(
  identifier: string,
  config: { limit: number; windowMs: number }
): Promise<void> {
  const allowed = await rateLimiter.check(identifier, config.limit, config.windowMs);
  
  if (!allowed) {
    const retryAfter = rateLimiter.getRetryAfter(identifier, config.windowMs);
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
    });
  }
}

