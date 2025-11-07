import { NextResponse } from 'next/server';
import { getAllFeatureFlags, getFeatureFlagValue } from '@/lib/feature-flags';

/**
 * GET /api/admin/feature-flags
 * 
 * Returns current feature flag configuration for debugging.
 * Shows all ENABLE_* environment variables and their values.
 */
export async function GET() {
  try {
    const flags = getAllFeatureFlags();
    const categorySystemValue = getFeatureFlagValue('CATEGORY_SYSTEM');

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      flags: {
        ...flags,
        // Highlight the category system flag
        CATEGORY_SYSTEM: {
          value: categorySystemValue,
          enabled: categorySystemValue 
            ? categorySystemValue.toLowerCase() === 'true' || categorySystemValue.toLowerCase() === '1'
            : false,
          description: 'Controls the 7-category quote system rollout'
        }
      },
      // Show all ENABLE_* vars for reference
      allEnvVars: Object.keys(process.env)
        .filter(key => key.startsWith('ENABLE_'))
        .reduce((acc, key) => {
          acc[key] = process.env[key] || null;
          return acc;
        }, {} as Record<string, string | null>)
    });
  } catch (error) {
    console.error('[FeatureFlags API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve feature flags',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

