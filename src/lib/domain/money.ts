/**
 * Money helpers. The database is the authority for prices and totals (numeric columns,
 * quote_cart / place_order). In TypeScript, amounts are converted to integer cents before any
 * arithmetic so previews (e.g. "Add to cart · $28.00") never suffer from float rounding.
 */
export const CURRENCY = 'USD';
const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: CURRENCY });

/** Accepts numbers or numeric strings ("12.50") and returns integer cents. */
export function toCents(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatCents(cents: number): string {
  return fmt.format(cents / 100).replace('-', '−');
}

export function formatMoney(v: number | string): string {
  return formatCents(toCents(v));
}

/** Same rule as the database: round(subtotal × rate, 2), half away from zero. */
export function percentOf(cents: number, rate: number): number {
  return Math.round(cents * rate);
}

export const SERVICE_FEE_RATE = 0.04;
