import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { isFeatureEnabled, getFeatureFlagValue, getAllFeatureFlags } from '@/lib/feature-flags';

// Save original env
const originalEnv = process.env;

describe('Feature Flags', () => {
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('isFeatureEnabled', () => {
    describe('Default behavior (flag not set)', () => {
      it('returns false when flag is not set', () => {
        delete process.env.ENABLE_CATEGORY_SYSTEM;
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });
    });

    describe('Explicit disable', () => {
      it('returns false for "false"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'false';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('returns false for "0"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '0';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('returns false for "off"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'off';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('returns false for "FALSE" (case insensitive)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'FALSE';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });
    });

    describe('Explicit enable', () => {
      it('returns true for "true"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'true';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(true);
      });

      it('returns true for "1"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '1';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(true);
      });

      it('returns true for "on"', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'on';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(true);
      });

      it('returns true for "TRUE" (case insensitive)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'TRUE';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(true);
      });
    });

    describe('Percentage rollout', () => {
      it('returns false for 0% rollout', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '0';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(false);
      });

      it('returns true for 100% rollout', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '100';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(true);
      });

      it('returns false when no userId provided for percentage', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '50';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', {})).toBe(false);
      });

      it('provides consistent results for same user (10% rollout)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '10';
        const userId = 'user-consistent-test';
        
        // Same user should always get same result
        const result1 = isFeatureEnabled('CATEGORY_SYSTEM', { userId });
        const result2 = isFeatureEnabled('CATEGORY_SYSTEM', { userId });
        const result3 = isFeatureEnabled('CATEGORY_SYSTEM', { userId });
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it('provides consistent results for same user (50% rollout)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '50';
        const userId = 'user-50-test';
        
        const result1 = isFeatureEnabled('CATEGORY_SYSTEM', { userId });
        const result2 = isFeatureEnabled('CATEGORY_SYSTEM', { userId });
        
        expect(result1).toBe(result2);
      });

      it('approximately matches percentage for large user set (10%)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '10';
        const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
        
        const enabledCount = users.filter(userId => 
          isFeatureEnabled('CATEGORY_SYSTEM', { userId })
        ).length;
        
        // Should be approximately 10% (allow 5-15% variance)
        const percentage = (enabledCount / users.length) * 100;
        expect(percentage).toBeGreaterThan(5);
        expect(percentage).toBeLessThan(15);
      });

      it('approximately matches percentage for large user set (50%)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '50';
        const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);
        
        const enabledCount = users.filter(userId => 
          isFeatureEnabled('CATEGORY_SYSTEM', { userId })
        ).length;
        
        // Should be approximately 50% (allow 40-60% variance)
        const percentage = (enabledCount / users.length) * 100;
        expect(percentage).toBeGreaterThan(40);
        expect(percentage).toBeLessThan(60);
      });
    });

    describe('User-specific enablement', () => {
      it('returns true for user in list', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'user-123,user-456,user-789';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(true);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-456' })).toBe(true);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-789' })).toBe(true);
      });

      it('returns false for user not in list', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'user-123,user-456';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-999' })).toBe(false);
      });

      it('returns false when no userId provided for user list', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'user-123,user-456';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', {})).toBe(false);
      });

      it('handles whitespace in user list', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'user-123, user-456 , user-789';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(true);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-456' })).toBe(true);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-789' })).toBe(true);
      });

      it('handles single user in list', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'user-123';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(true);
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-456' })).toBe(false);
      });
    });

    describe('Edge cases', () => {
      it('handles unknown format gracefully (defaults to false)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = 'invalid-format-xyz';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('handles empty string (defaults to false)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('handles whitespace-only string', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '   ';
        expect(isFeatureEnabled('CATEGORY_SYSTEM')).toBe(false);
      });

      it('handles negative percentage (defaults to false)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '-10';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(false);
      });

      it('handles percentage over 100 (defaults to false)', () => {
        process.env.ENABLE_CATEGORY_SYSTEM = '150';
        expect(isFeatureEnabled('CATEGORY_SYSTEM', { userId: 'user-123' })).toBe(false);
      });
    });

    describe('Different flag names', () => {
      it('works with different flag names', () => {
        process.env.ENABLE_NEW_FEATURE = 'true';
        process.env.ENABLE_ANOTHER_FEATURE = 'false';
        
        expect(isFeatureEnabled('NEW_FEATURE')).toBe(true);
        expect(isFeatureEnabled('ANOTHER_FEATURE')).toBe(false);
      });
    });
  });

  describe('getFeatureFlagValue', () => {
    it('returns the environment variable value', () => {
      process.env.ENABLE_CATEGORY_SYSTEM = 'true';
      expect(getFeatureFlagValue('CATEGORY_SYSTEM')).toBe('true');
    });

    it('returns null when flag is not set', () => {
      delete process.env.ENABLE_CATEGORY_SYSTEM;
      expect(getFeatureFlagValue('CATEGORY_SYSTEM')).toBe(null);
    });

    it('handles different flag names', () => {
      process.env.ENABLE_TEST_FLAG = '50';
      expect(getFeatureFlagValue('TEST_FLAG')).toBe('50');
    });
  });

  describe('getAllFeatureFlags', () => {
    it('returns all ENABLE_* environment variables', () => {
      process.env.ENABLE_CATEGORY_SYSTEM = 'true';
      process.env.ENABLE_NEW_FEATURE = 'false';
      process.env.ENABLE_TEST = '50';
      process.env.NOT_A_FLAG = 'value';
      
      const flags = getAllFeatureFlags();
      
      expect(flags.CATEGORY_SYSTEM).toBe('true');
      expect(flags.NEW_FEATURE).toBe('false');
      expect(flags.TEST).toBe('50');
      expect(flags.NOT_A_FLAG).toBeUndefined();
    });

    it('returns empty object when no flags are set', () => {
      // Clear all ENABLE_* vars
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('ENABLE_')) {
          delete process.env[key];
        }
      });
      
      const flags = getAllFeatureFlags();
      expect(Object.keys(flags).length).toBe(0);
    });
  });
});

