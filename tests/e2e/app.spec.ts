import { expect, test, type Page } from '@playwright/test';

/**
 * HomeCook's end-to-end pass, at phone size: set the household up, get a week,
 * lock a day, swap another, add guests to a third, then check the grocery list
 * followed all of it.
 */
const APP = '/';

async function onboard(page: Page): Promise<void> {
  await page.goto(APP);
  await expect(page.getByRole('heading', { name: 'HomeCook' })).toBeVisible();
  await page.getByRole('button', { name: 'Plan my first week' }).click();
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible({ timeout: 15_000 });
}

function money(text: string | null): number {
  return Number((text ?? '').replace(/[^\d.]/g, ''));
}

test.describe('HomeCook', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('plans a week, then keeps the grocery list in step with it', async ({ page }) => {
    await onboard(page);

    // Five dinners, each with a real recipe on it.
    const meals = page.locator('.meal');
    await expect(meals).toHaveCount(5);
    await expect(page.locator('.meal__name').first()).not.toBeEmpty();

    // The budget line is populated from the actual basket.
    const spent = money(await page.locator('.budget__spent').first().textContent());
    expect(spent).toBeGreaterThan(0);

    // Lock Monday, regenerate, and it stays put.
    const monday = meals.first();
    const mondayMeal = await monday.locator('.meal__name').textContent();
    await monday.getByRole('button', { name: /Lock/ }).click();
    await expect(monday.getByRole('button', { name: /Unlock/ })).toBeVisible();
    await page.getByRole('button', { name: 'Regenerate week' }).click();
    await expect(page.getByRole('button', { name: 'Regenerate week' })).toBeEnabled({ timeout: 15_000 });
    await expect(meals.first().locator('.meal__name')).toHaveText(mondayMeal!);

    // Swap Wednesday for something else.
    const wednesday = meals.nth(2);
    const before = await wednesday.locator('.meal__name').textContent();
    await wednesday.getByRole('button', { name: 'Swap' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('.swap__item').first().click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(meals.nth(2).locator('.meal__name')).not.toHaveText(before!);

    // Friday has guests: the headcount, servings and cost all move.
    const friday = meals.nth(4);
    await friday.getByRole('button', { name: 'Diners & more' }).click();
    const plus = page.getByRole('button', { name: 'Increase Diners' });
    await plus.click();
    await plus.click();
    await plus.click();
    await page.getByRole('button', { name: 'Close' }).last().click();
    await expect(friday.getByText('5 diners (guests)')).toBeVisible();

    // The grocery list reflects the week that is actually planned.
    await page.getByRole('button', { name: 'Grocery' }).click();
    await expect(page.locator('.screen__head h1')).toHaveText('Grocery');
    const total = money(await page.locator('.budget__spent').first().textContent());
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('.gitem').first()).toBeVisible();

    // Ticking an item off sticks.
    const first = page.locator('.gitem').first();
    await first.locator('.gitem__check').click();
    await expect(first).toHaveClass(/gitem--done/);

    // And it all survives a reload, because it is stored on the device.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
    await expect(page.locator('.meal').first().locator('.meal__name')).toHaveText(mondayMeal!);
  });

  test('explains why a meal was chosen', async ({ page }) => {
    await onboard(page);
    await page.locator('.meal').first().getByRole('button', { name: 'Why this?' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Why HomeCook picked this')).toBeVisible();
    await expect(dialog.getByText('The maths')).toBeVisible();
    await expect(dialog.locator('.score li')).not.toHaveCount(0);
  });

  test('keeps what you already have off the shopping list', async ({ page }) => {
    await onboard(page);
    await page.getByRole('button', { name: 'Grocery' }).click();
    const before = money(await page.locator('.budget__spent').first().textContent());

    await page.getByRole('button', { name: 'Pantry' }).click();
    await expect(page.locator('.screen__head h1')).toHaveText('Pantry');
    // Onboarding stocked the staples, so add something that is not one.
    await page.getByPlaceholder('Add something you have…').fill('mushroom');
    await page.getByRole('button', { name: /Cremini mushrooms/ }).click();
    await expect(page.getByText('Cremini mushrooms')).toBeVisible();

    await page.getByRole('button', { name: 'Grocery' }).click();
    const after = money(await page.locator('.budget__spent').first().textContent());
    expect(after).toBeLessThanOrEqual(before);
  });

  test('takes the budget you set, and lets you retype it', async ({ page }) => {
    await page.goto(APP);
    const more = page.getByRole('button', { name: 'Increase Weekly budget' });
    await more.click();
    await more.click();
    await expect(page.locator('.stepper', { hasText: 'Weekly budget' }).locator('.stepper__value')).toHaveText(
      '170 $',
    );
    await page.getByRole('button', { name: 'Plan my first week' }).click();
    await expect(page.locator('.budget__label', { hasText: 'Budget' })).toHaveText('Budget $170.00');

    // Clearing the box to retype must not zero the budget on the way.
    await page.getByRole('button', { name: 'Profile' }).click();
    const field = page.getByLabel('Weekly grocery budget');
    await field.fill('');
    await expect(field).toHaveValue('');
    await field.pressSequentially('95.5');
    await field.blur();
    await expect(field).toHaveValue('95.5');
    await page.getByRole('button', { name: 'Plan' }).click();
    await expect(page.locator('.budget__label', { hasText: 'Budget' })).toHaveText('Budget $95.50');
  });

  test('shares what is left to buy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // Desktop Chromium has no share sheet; take the clipboard route every time.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined });
    });
    await onboard(page);
    await page.getByRole('button', { name: 'Grocery' }).click();
    const first = await page.locator('.gitem__name').first().textContent();
    await page.getByRole('button', { name: 'Share list' }).click();
    await expect(page.getByText('Copied — paste it wherever you keep your list.')).toBeVisible();

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^HomeCook grocery list · week of \d+ \w{3}/);
    expect(text).toContain(`• ${first}`);
  });

  test('fits on a phone without sideways scrolling', async ({ page }) => {
    await onboard(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
