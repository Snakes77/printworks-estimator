#!/usr/bin/env node

/**
 * PrintWorks Estimator - Verification Script
 *
 * Runs all quality checks before deployment:
 * - Type checking
 * - Linting
 * - Unit tests
 * - E2E tests (optional)
 * - Environment validation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const execAsync = promisify(exec);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const banner = (text, color = colors.cyan) => {
  const line = '='.repeat(60);
  console.log(`\n${color}${colors.bright}${line}${colors.reset}`);
  console.log(`${color}${colors.bright}  ${text}${colors.reset}`);
  console.log(`${color}${colors.bright}${line}${colors.reset}\n`);
};

const success = (text) => console.log(`${colors.green}✓${colors.reset} ${text}`);
const error = (text) => console.log(`${colors.red}✗${colors.reset} ${text}`);
const info = (text) => console.log(`${colors.blue}ℹ${colors.reset} ${text}`);
const warn = (text) => console.log(`${colors.yellow}⚠${colors.reset} ${text}`);

const runStep = async (name, command, { optional = false, skipOnCI = false } = {}) => {
  banner(name);

  if (skipOnCI && process.env.CI) {
    warn(`Skipping on CI: ${name}`);
    return true;
  }

  try {
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    success(`${name} completed in ${duration}s`);
    return true;
  } catch (err) {
    error(`${name} failed`);
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);

    if (optional) {
      warn(`${name} failed but marked as optional, continuing...`);
      return true;
    }

    return false;
  }
};

const checkEnvironment = () => {
  banner('Environment Validation');

  const envExamplePath = resolve(process.cwd(), '.env.example');
  const envLocalPath = resolve(process.cwd(), '.env.local');
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envExamplePath)) {
    error('.env.example not found');
    return false;
  }

  success('.env.example exists');

  const hasEnvLocal = existsSync(envLocalPath);
  const hasEnv = existsSync(envPath);

  if (!hasEnvLocal && !hasEnv) {
    error('No .env.local or .env file found');
    info('Copy .env.example to .env.local and configure your Supabase settings');
    return false;
  }

  if (hasEnvLocal) success('.env.local exists');
  if (hasEnv) success('.env exists');

  // Check for required environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
  ];

  const envContent = hasEnvLocal
    ? readFileSync(envLocalPath, 'utf-8')
    : readFileSync(envPath, 'utf-8');

  const missingVars = requiredVars.filter(varName => {
    return !envContent.includes(`${varName}=`) ||
           envContent.includes(`${varName}=your-`) ||
           envContent.includes(`${varName}=https://your-`);
  });

  if (missingVars.length > 0) {
    warn('The following environment variables appear to be unconfigured:');
    missingVars.forEach(v => warn(`  - ${v}`));
    warn('Tests may fail without proper Supabase configuration');
  } else {
    success('All required environment variables appear to be configured');
  }

  return true;
};

const main = async () => {
  console.log(`
${colors.cyan}${colors.bright}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         PrintWorks Estimator - Verify Script             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}
`);

  const steps = [
    {
      name: 'Environment Check',
      run: checkEnvironment,
    },
    {
      name: 'Install Dependencies',
      command: 'npm ci --prefer-offline --no-audit',
      optional: true, // Optional if already installed
    },
    {
      name: 'Generate Prisma Client',
      command: 'npx prisma generate',
    },
    {
      name: 'TypeScript Type Check',
      command: 'npm run typecheck',
    },
    {
      name: 'ESLint',
      command: 'npm run lint',
    },
    {
      name: 'Unit Tests',
      command: 'npm run test',
    },
    {
      name: 'E2E Tests',
      command: 'npm run test:e2e',
      optional: true, // E2E tests may require running server
      skipOnCI: true,
    },
  ];

  let allPassed = true;

  for (const step of steps) {
    let passed = false;

    if (step.run) {
      passed = step.run();
    } else if (step.command) {
      passed = await runStep(step.name, step.command, {
        optional: step.optional,
        skipOnCI: step.skipOnCI,
      });
    }

    if (!passed && !step.optional) {
      allPassed = false;
      break;
    }
  }

  console.log('\n');

  if (allPassed) {
    banner('✓ All Checks Passed', colors.green);
    console.log(`${colors.green}${colors.bright}
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   Ready for localhost:3000 and Vercel deployment     ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
${colors.reset}\n`);
    process.exit(0);
  } else {
    banner('✗ Verification Failed', colors.red);
    console.log(`${colors.red}${colors.bright}
  Please fix the errors above before deploying.
${colors.reset}\n`);
    process.exit(1);
  }
};

main().catch((err) => {
  error('Unexpected error during verification');
  console.error(err);
  process.exit(1);
});
