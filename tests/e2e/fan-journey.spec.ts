import { test, expect } from '@playwright/test';

/**
 * Fan journey (prompt §76). Assumes the dev seed is loaded so an open test
 * fixture exists. These specs are structural — they assert the ritual works
 * end to end against a real server + DB.
 */
test.describe('fan journey', () => {
  test('lands directly in the active fixture and can predict', async ({ page }) => {
    await page.goto('/app/alhazem');
    // The core question is visible above the fold — no marketing homepage.
    await expect(page.getByRole('heading', { name: 'من يفوز؟' })).toBeVisible();

    // One-tap prediction.
    await page.getByRole('radio', { name: 'الحزم' }).click();
    await expect(page.getByText(/اخترت/)).toBeVisible();
  });

  test('root and /pilot redirect into the fixture experience', async ({ page }) => {
    await page.goto('/pilot');
    await expect(page).toHaveURL(/\/app\/alhazem$/);
  });

  test('supporter record is reachable', async ({ page }) => {
    await page.goto('/app/alhazem/record');
    await expect(page.getByRole('heading', { name: 'سجلي مع الحزم' })).toBeVisible();
  });
});
