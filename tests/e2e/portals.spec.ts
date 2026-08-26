import { test, expect } from '@playwright/test';

/**
 * Portal access-control specs (prompt §74, §75, §76). Unauthenticated access
 * to ops/merchant must present a login wall — never data.
 */
test.describe('portal authentication walls', () => {
  test('ops portal requires authentication', async ({ page }) => {
    await page.goto('/ops');
    await expect(page.getByText('FanHour Operations')).toBeVisible();
    // No dashboard metrics leak to an unauthenticated visitor.
    await expect(page.getByText('North Star')).toHaveCount(0);
  });

  test('merchant portal requires authentication', async ({ page }) => {
    await page.goto('/merchant');
    await expect(page.getByText('FanHour Merchant')).toBeVisible();
    await expect(page.getByPlaceholder('FH-XXXX-XXXX')).toHaveCount(0);
  });
});

test.describe('legal pages', () => {
  test('privacy page renders (blocker marker until approved copy)', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'سياسة الخصوصية' })).toBeVisible();
  });
});
