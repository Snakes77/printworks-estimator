/**
 * Feature Flag System
 * 
 * Provides safe, gradual rollout of new features using environment variables.
 * Supports: disabled, enabled for all, percentage rollout, and user-specific enablement.
 */

type FeatureFlagContext = {
  userId?: string;
  email?: string;
};

type FeatureFlagValue = 
  | 'false' 
  | 'true' 
  | string; // Percentage (e.g., "10", "50") or comma-separated user IDs

/**
 * Consistent hash function for percentage-based rollouts.
 * Same user will always get the same result.
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Checks if a feature flag is enabled for the given context.
 * 
 * @param flagName - Name of the feature flag (e.g., 'CATEGORY_SYSTEM')
 * @param context - User context (userId, email) for percentage/user-specific checks
 * @returns true if feature is enabled, false otherwise
 * 
 * @example
 * // Environment variable: ENABLE_CATEGORY_SYSTEM=false
 * isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' }) // false
 * 
 * @example
 * // Environment variable: ENABLE_CATEGORY_SYSTEM=true
 * isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' }) // true
 * 
 * @example
 * // Environment variable: ENABLE_CATEGORY_SYSTEM=10
 * isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' }) // ~10% of users
 * 
 * @example
 * // Environment variable: ENABLE_CATEGORY_SYSTEM=user-123,user-456
 * isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' }) // true
 * isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-999' }) // false
 */
export function isFeatureEnabled(
  flagName: string,
  context: FeatureFlagContext = {}
): boolean {
  // Get environment variable (e.g., ENABLE_CATEGORY_SYSTEM)
  const envVarName = `ENABLE_${flagName}`;
  const flagValue = process.env[envVarName];

  // Default to false if not set
  if (!flagValue) {
    return false;
  }

  const normalizedValue = flagValue.trim().toLowerCase();

  // Explicitly disabled
  if (normalizedValue === 'false' || normalizedValue === '0' || normalizedValue === 'off') {
    return false;
  }

  // Explicitly enabled for all
  if (normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'on') {
    return true;
  }

  // Percentage rollout (e.g., "10", "50")
  const percentage = parseInt(normalizedValue, 10);
  if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
    // Need userId for consistent hashing
    if (!context.userId) {
      // If no userId provided, default to false for percentage rollouts
      return false;
    }

    // Consistent hash-based rollout
    const hash = hashUserId(context.userId);
    const userPercentage = (hash % 100) + 1; // 1-100
    
    return userPercentage <= percentage;
  }

  // User-specific enablement (comma-separated list)
  // e.g., "user-123,user-456,user-789"
  const userIds = normalizedValue.split(',').map(id => id.trim()).filter(Boolean);
  
  if (userIds.length > 0 && context.userId) {
    return userIds.includes(context.userId);
  }

  // If it's a user ID list but no userId in context, default to false
  if (userIds.length > 0) {
    return false;
  }

  // Unknown format - default to false for safety
  console.warn(
    `[FeatureFlags] Unknown flag value format for ${envVarName}: "${flagValue}". Defaulting to false.`
  );
  return false;
}

/**
 * Gets the current value of a feature flag (for debugging).
 * 
 * @param flagName - Name of the feature flag
 * @returns The raw environment variable value, or null if not set
 */
export function getFeatureFlagValue(flagName: string): string | null {
  const envVarName = `ENABLE_${flagName}`;
  return process.env[envVarName] || null;
}

/**
 * Gets all feature flags and their values (for debugging).
 * 
 * @returns Object with all feature flags and their current values
 */
export function getAllFeatureFlags(): Record<string, string | null> {
  // Extract all ENABLE_* environment variables
  const flags: Record<string, string | null> = {};
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('ENABLE_')) {
      const flagName = key.replace('ENABLE_', '');
      flags[flagName] = value || null;
    }
  }
  
  return flags;
}

