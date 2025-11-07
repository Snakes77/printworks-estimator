# Feature Flags Guide

## Overview

The feature flag system allows safe, gradual rollout of new features without breaking production. This is especially important for the 7-category quote system implementation.

## Environment Variable Format

Feature flags use the pattern: `ENABLE_<FLAG_NAME>`

For the category system: `ENABLE_CATEGORY_SYSTEM`

## Configuration Modes

### 1. Disabled (Default)

```bash
# Not set, or explicitly false
ENABLE_CATEGORY_SYSTEM=false
ENABLE_CATEGORY_SYSTEM=0
ENABLE_CATEGORY_SYSTEM=off
```

**Result:** Feature is disabled for all users. Old system (V1) is used.

### 2. Enabled for All

```bash
ENABLE_CATEGORY_SYSTEM=true
ENABLE_CATEGORY_SYSTEM=1
ENABLE_CATEGORY_SYSTEM=on
```

**Result:** Feature is enabled for all users. New system (V2) is used.

### 3. Percentage Rollout

```bash
ENABLE_CATEGORY_SYSTEM=10   # 10% of users
ENABLE_CATEGORY_SYSTEM=50   # 50% of users
ENABLE_CATEGORY_SYSTEM=75   # 75% of users
```

**Result:** Feature is enabled for the specified percentage of users. Uses consistent hashing - same user always gets the same result.

**Important:** Requires `userId` in the feature flag context. If no `userId` is provided, defaults to disabled.

### 4. User-Specific Enablement

```bash
ENABLE_CATEGORY_SYSTEM=user-123,user-456,user-789
```

**Result:** Feature is enabled only for the specified user IDs.

**Use case:** Testing with specific users before broader rollout.

## Usage Examples

### Development

```bash
# .env.local
ENABLE_CATEGORY_SYSTEM=true
```

Test the new system locally.

### Production (Initial Deployment)

```bash
# Vercel Environment Variables
ENABLE_CATEGORY_SYSTEM=false
```

Deploy new code but keep it disabled. Old system continues working.

### Production (Testing for Yourself)

```bash
ENABLE_CATEGORY_SYSTEM=your-user-id-here
```

Only you see the new system. Others see the old system.

### Production (Gradual Rollout)

```bash
# Start with 10%
ENABLE_CATEGORY_SYSTEM=10

# Monitor for issues, then increase to 50%
ENABLE_CATEGORY_SYSTEM=50

# If all good, enable for everyone
ENABLE_CATEGORY_SYSTEM=true
```

## Implementation Details

### In Code

```typescript
import { isFeatureEnabled } from '@/lib/feature-flags';

// Check if category system is enabled for a user
const useV2 = isFeatureEnabled('CATEGORY_SYSTEM', { userId: user.id });

if (useV2) {
  // Use new V2 system with categories
  const totals = calculateTotalsV2(lines, quantity, discountPercentage);
} else {
  // Use old V1 system
  const totals = calculateTotalsV1(lines, discountPercentage);
}
```

### Router Function

The `calculateTotals` function in `lib/pricing.ts` automatically checks the feature flag:

```typescript
// Old signature (V1) - works when flag is off
const totals = calculateTotals(lines, discountPercentage);

// New signature (V2) - works when flag is on
const totals = calculateTotals(lines, quantity, discountPercentage, userId);
```

The router function detects which signature you're using and calls the appropriate version based on the feature flag.

## Debugging

### Check Current Flag Status

Visit: `http://localhost:3000/api/admin/feature-flags`

Returns JSON with:
- Current flag values
- Environment (development/production)
- Timestamp
- All `ENABLE_*` environment variables

### Example Response

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "environment": "development",
  "flags": {
    "CATEGORY_SYSTEM": {
      "value": "true",
      "enabled": true,
      "description": "Controls the 7-category quote system rollout"
    }
  },
  "allEnvVars": {
    "ENABLE_CATEGORY_SYSTEM": "true"
  }
}
```

## Rollout Strategy

### Phase 1: Deploy (Flag OFF)

1. Deploy new code with `ENABLE_CATEGORY_SYSTEM=false`
2. Verify old system still works
3. No user-facing changes

### Phase 2: Internal Testing (User-Specific)

1. Set `ENABLE_CATEGORY_SYSTEM=your-user-id`
2. Test thoroughly in production
3. Verify calculations match expectations

### Phase 3: Small Rollout (10%)

1. Set `ENABLE_CATEGORY_SYSTEM=10`
2. Monitor error rates
3. Check user feedback
4. Verify calculations are correct

### Phase 4: Medium Rollout (50%)

1. Set `ENABLE_CATEGORY_SYSTEM=50`
2. Continue monitoring
3. Watch for any edge cases

### Phase 5: Full Rollout (100%)

1. Set `ENABLE_CATEGORY_SYSTEM=true`
2. All users see new system
3. Monitor for 24-48 hours

### Rollback Plan

If issues are detected:

1. **Immediate:** Set `ENABLE_CATEGORY_SYSTEM=false`
2. **No code changes needed** - just update environment variable
3. **Instant effect** - all users revert to old system

## Testing

Run feature flag tests:

```bash
npm test tests/feature-flags.test.ts
```

Tests cover:
- Default behavior (disabled)
- Explicit enable/disable
- Percentage rollouts
- User-specific enablement
- Consistent hashing
- Edge cases

## Important Notes

1. **Consistent Hashing:** Same user always gets the same result in percentage rollouts
2. **No userId = Disabled:** Percentage and user-specific modes require `userId` in context
3. **Case Insensitive:** Flag values are normalized (true/TRUE/True all work)
4. **Safe Defaults:** Unknown formats default to disabled (false)
5. **No External Dependencies:** Uses only environment variables

## Troubleshooting

### Flag not working?

1. Check environment variable is set: `echo $ENABLE_CATEGORY_SYSTEM`
2. Visit debug endpoint: `/api/admin/feature-flags`
3. Verify variable name matches: `ENABLE_<FLAG_NAME>`
4. Check for typos in flag value

### Percentage rollout not working?

1. Ensure `userId` is provided in context
2. Check percentage is 0-100
3. Verify user ID format is consistent

### User-specific not working?

1. Check user ID matches exactly (case-sensitive)
2. Verify comma-separated list format
3. Ensure no extra spaces (handled automatically)

## Best Practices

1. **Always start with flag OFF** when deploying new features
2. **Test in development first** with flag ON
3. **Use user-specific mode** for initial production testing
4. **Gradual rollout** (10% → 50% → 100%)
5. **Monitor closely** during rollout
6. **Have rollback plan ready** (just change env var)

## Related Files

- `lib/feature-flags.ts` - Core feature flag logic
- `lib/pricing.ts` - Dual pricing functions (V1/V2)
- `app/api/admin/feature-flags/route.ts` - Debug endpoint
- `tests/feature-flags.test.ts` - Test suite

