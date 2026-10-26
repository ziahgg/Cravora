import { expect, test, type Page } from '@playwright/test';

/**
 * Critical customer + restaurant journeys against a local Supabase stack with the dev seed:
 *   npm run db:reset && E2E_BASE_URL=http://localhost:3002 npm run test:e2e
 * Accounts are development seed values (supabase/seed.sql), not real users.
 */
const DEMO = { email: 'demo@cravora.test', password: 'cravora-demo' };
const OWNER = { email: 'owner@cravora.test', password: 'cravora-owner' };
const OWNER2 = { email: 'owner2@cravora.test', password: 'cravora-owner' };

const toast = (page: Page) => page.locator('[aria-live="polite"] > [role="status"]');

async function signIn(page: Page, who: { email: string; password: string }, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(new RegExp(`${next === '/' ? '/$' : next.replace(/\//g, '\\/')}`));
}

async function signOut(page: Page) {
  await page.context().clearCookies();
}

test.describe.configure({ mode: 'serial' });

let orderUrl = '';

test('browse publicly; adding to cart asks to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Popular on Cravora' })).toBeVisible();
  await page.getByRole('link', { name: 'Stack & Smoke Burgers' }).first().click();
  await expect(page.getByRole('heading', { name: 'Stack & Smoke Burgers' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Cola to cart' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Frestaurants%2Fstack-smoke/);
});

test('customer orders: options, cart, promo rules, checkout, confirmation and history', async ({ page }) => {
  await signIn(page, DEMO, '/restaurants/stack-smoke');

  // Required option must be chosen before adding.
  await page.getByRole('button', { name: 'Choose options for Double Smash Cheeseburger' }).first().click();
  await expect(page).toHaveURL(/\/dishes\//);
  await page.getByRole('button', { name: /Add to cart · \$12\.50/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'One more choice needed' })).toBeVisible();
  await page.getByRole('radio', { name: 'Brioche' }).check();
  await page.getByRole('checkbox', { name: /Smoked bacon/ }).check();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart · $28.00' }).click();
  await expect(toast(page)).toContainText('Added to cart');
  await expect(page).toHaveURL(/\/restaurants\/stack-smoke$/);

  // Truffle fries (required size) and wings (required sauce).
  await page.goto('/restaurants/stack-smoke');
  await page.getByRole('link', { name: 'Truffle Parmesan Fries' }).first().click();
  await page.getByRole('radio', { name: 'Regular' }).check();
  await page.getByRole('button', { name: 'Add to cart · $5.50' }).click();
  await expect(toast(page)).toContainText('Added to cart');
  await page.goto('/restaurants/stack-smoke');
  await page.getByRole('link', { name: 'Hot Wings (6 pcs)' }).first().click();
  await page.getByRole('radio', { name: 'Chipotle glaze' }).check();
  await page.getByRole('button', { name: 'Add to cart · $9.00' }).click();
  await expect(page.getByRole('link', { name: 'View cart' })).toBeVisible();

  // Cart: quantity update and server totals ($42.50 + $2.99 + $1.70 = $47.19).
  await page.goto('/cart');
  await expect(page.getByText('Subtotal (4 items)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Checkout · $47.19' })).toBeVisible();
  await page.getByRole('button', { name: 'Increase Hot Wings (6 pcs) quantity' }).click();
  await expect(page.getByRole('link', { name: 'Checkout · $56.55' })).toBeVisible(); // 51.50 + 2.99 + 2.06
  await page.getByRole('button', { name: 'Decrease Hot Wings (6 pcs) quantity' }).click();
  await expect(page.getByRole('link', { name: 'Checkout · $47.19' })).toBeVisible();

  // WELCOME10 is first-order only; the demo account already has orders.
  await page.getByLabel('Promo code').fill('welcome10');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('WELCOME10 can’t be used')).toBeVisible();
  await expect(page.getByText('WELCOME10 is for your first order only.')).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).first().click();

  // Checkout with cash on delivery.
  await page.getByRole('link', { name: 'Checkout · $47.19' }).click();
  await expect(page.getByText('214 Maple Ave, Apt 3B, Austin 78704')).toBeVisible();
  await page.getByRole('radio', { name: /Cash on delivery/ }).click();
  await page.getByRole('button', { name: 'Place order · $47.19' }).click();
  await expect(page).toHaveURL(/\/orders\/.+\/confirmed$/);
  await expect(page.getByRole('heading', { name: 'Order placed!' })).toBeVisible();
  await expect(page.getByText('$47.19')).toBeVisible();
  orderUrl = page.url().replace(/\/confirmed$/, '');

  // Cart is empty afterwards; the order is in history and details show snapshots.
  await page.goto('/cart');
  await expect(page.getByText('Your cart is empty')).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByRole('link', { name: /Track order/ }).first()).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.getByText('Waiting for Stack & Smoke Burgers to confirm')).toBeVisible();
  await expect(page.getByText('+ Smoked bacon').first()).toBeVisible();
  await expect(page.getByText('Pay the courier on delivery')).toBeVisible();
});

test('another restaurant owner cannot see or change the order', async ({ page }) => {
  await signIn(page, OWNER2, '/restaurant/orders');
  await expect(page.getByText(/CRV-\d+ · Stack & Smoke/)).toHaveCount(0);
  await page.goto(orderUrl);
  await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
  await signOut(page);
});

test('owner moves the order through the state machine; customer sees progress and can rate', async ({ page }) => {
  await signIn(page, OWNER, '/restaurant/orders');
  const card = page.locator('li').filter({ hasText: 'Ziah Makmur' }).filter({ has: page.getByRole('button') }).first();
  for (const action of ['Accept order', 'Start preparing', 'Hand to courier', 'Mark delivered']) {
    await card.getByRole('button', { name: action }).click();
    await expect(page.getByRole('button', { name: action })).toHaveCount(0, { timeout: 10_000 });
  }
  await signOut(page);

  await signIn(page, DEMO, '/orders');
  await page.goto(orderUrl);
  await expect(page.getByText(/^Delivered · /)).toBeVisible();
  await expect(page.getByText('Paid in cash on delivery')).toBeVisible();
  await page.getByRole('radio', { name: '5 stars' }).click();
  await page.getByRole('button', { name: 'Submit rating' }).click();
  await expect(page.getByText('You rated this order 5/5. Thanks!')).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByText('Order delivered').first()).toBeVisible();
});

test('customer can cancel a pending order, not a confirmed one; reorder refills the cart', async ({ page }) => {
  await signIn(page, DEMO, '/orders');
  await page.goto(orderUrl);
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Order again' }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole('link', { name: 'Checkout · $47.19' })).toBeVisible();
  await page.getByRole('link', { name: 'Checkout · $47.19' }).click();
  await page.getByRole('button', { name: 'Place order · $47.19' }).click();
  await expect(page).toHaveURL(/\/confirmed$/);
  await page.getByRole('link', { name: 'Track order' }).click();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByText(/^Cancelled · /)).toBeVisible();
  await expect(page.getByText('Not charged.')).toBeVisible();
});

test('mixing restaurants requires a deliberate choice', async ({ page }) => {
  await signIn(page, DEMO, '/restaurants/stack-smoke');
  await page.getByRole('button', { name: 'Add Cola to cart' }).click();
  await expect(toast(page)).toContainText('Added to cart');
  await page.goto('/restaurants/kintsugi-ramen');
  await page.getByRole('button', { name: 'Add Tonkotsu Ramen to cart' }).first().click();
  await expect(page.getByRole('alertdialog')).toContainText('Start a new cart?');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep current cart' }).click();
  await page.goto('/cart');
  await expect(page.getByText('Stack & Smoke Burgers')).toBeVisible();
  await page.getByRole('button', { name: 'Decrease Cola quantity' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
});

test('private pages redirect to sign-in when signed out', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login\?next=%2Forders/);
});
