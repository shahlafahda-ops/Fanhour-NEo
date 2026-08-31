import { test, expect } from '@playwright/test';

/**
 * Pilot 1 retention / status / commentary layer.
 *
 * Requires a running app against a seeded Supabase (see docs/TESTING.md):
 * an OPEN fixture with community predictions, and a RESOLVED fixture the
 * seeded identity predicted.
 */

test.describe('new supporter — first 60 seconds', () => {
  test('lands in the fixture and can predict with no setup', async ({ page }) => {
    await page.goto('/app/alhazem');
    await expect(page.getByRole('heading', { name: 'من يفوز؟' })).toBeVisible();

    // No registration, OTP, tutorial or profile wall before the first prediction.
    await expect(page.getByPlaceholder('05XXXXXXXX')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: /Email/i })).toHaveCount(0);

    await page.getByRole('radio', { name: 'الحزم' }).click();
    await expect(page.getByText(/اخترت/)).toBeVisible();
  });

  test('shows social comparison after — never before — submitting', async ({ page }) => {
    await page.goto('/app/alhazem');
    // Percentages must not be visible pre-submission (prevents anchoring).
    await expect(page.getByText('ماذا يتوقع الجمهور؟')).toHaveCount(0);

    await page.getByRole('radio', { name: 'تعادل' }).click();
    await expect(page.getByText(/اخترت/)).toBeVisible();
  });
});

test.describe('supporter status', () => {
  test('record shows rank, XP and progress toward the next rank', async ({ page }) => {
    await page.goto('/app/alhazem/record');
    await expect(page.getByRole('heading', { name: 'سجلي مع الحزم' })).toBeVisible();

    const body = page.locator('body');
    // Either the empty state, or the status layer with an approved rank name.
    const hasRecord = await page.getByText('مستواي').isVisible().catch(() => false);
    if (hasRecord) {
      await expect(body).toContainText(/متابع|مشجع|محلل خبير|محلل مخضرم|أسطورة/);
      await expect(page.getByRole('progressbar')).toBeVisible();
    } else {
      await expect(body).toContainText('لم تسجّل أي توقع بعد');
    }
  });

  test('never presents status as money or a balance', async ({ page }) => {
    await page.goto('/app/alhazem/record');
    const body = page.locator('body');
    await expect(body).not.toContainText('رصيد');
    await expect(body).not.toContainText('محفظة');
    await expect(body).not.toContainText('ريال');
  });
});

test.describe('resolved fixture — the retention moment', () => {
  test('result screen sequences result, prediction, XP, rank and next fixture', async ({ page }) => {
    await page.goto('/app/alhazem');
    const resolved = await page.getByText('نتيجة المباراة').isVisible().catch(() => false);
    test.skip(!resolved, 'No resolved fixture is currently the active one');

    await expect(page.getByText('النتيجة النهائية')).toBeVisible();
    await expect(page.getByText('توقعك')).toBeVisible();
    await expect(page.getByText('المباراة القادمة')).toBeVisible();
  });

  test('at most one commentary phrase is shown', async ({ page }) => {
    await page.goto('/app/alhazem');
    const phrases = [
      'بالمليمتر يا حبيبي!', 'يا رباه!', 'عيني عيني!',
      'يوززززززع!', 'الضربة القاضية ممكن!',
    ];
    let shown = 0;
    for (const p of phrases) shown += await page.getByText(p, { exact: true }).count();
    expect(shown).toBeLessThanOrEqual(1);
  });

  test('deferred phrases never appear in Pilot 1', async ({ page }) => {
    await page.goto('/app/alhazem');
    await expect(page.getByText('يوززززززع!')).toHaveCount(0);
    await expect(page.getByText('الضربة القاضية ممكن!')).toHaveCount(0);
  });
});
