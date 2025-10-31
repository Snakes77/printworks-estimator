import { test, expect } from '@playwright/test';

test.describe('authentication', () => {
  test('login page renders with magic link prompt', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to PrintWorks Estimator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email magic link' })).toBeVisible();
  });
});
