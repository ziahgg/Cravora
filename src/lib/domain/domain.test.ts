import { describe, expect, it } from 'vitest';

import { addressSchema, addToCartSchema, checkoutSchema, promoSchema } from '@/lib/validations';
import { defaultSelection, selectionErrors, toggleValue, unitPriceCents, type OptionGroup } from './menu';
import { formatCents, formatMoney, percentOf, SERVICE_FEE_RATE, toCents } from './money';
import { canTransition, customerCanCancel, estimatedArrival, isActive, TRACK_STEPS, TRANSITIONS } from './orders';

const bun: OptionGroup = {
  id: 'bun',
  name: 'Choose bun',
  selection_type: 'single',
  is_required: true,
  min_selections: 1,
  max_selections: 1,
  values: [
    { id: 'brioche', name: 'Brioche', additional_price: 0, is_available: true },
    { id: 'potato', name: 'Potato bun', additional_price: '0.00', is_available: true },
  ],
};
const addons: OptionGroup = {
  id: 'addons',
  name: 'Add-ons',
  selection_type: 'multiple',
  is_required: false,
  min_selections: 0,
  max_selections: 2,
  values: [
    { id: 'bacon', name: 'Smoked bacon', additional_price: '1.50', is_available: true },
    { id: 'cheese', name: 'Extra cheese', additional_price: 1, is_available: true },
    { id: 'jalapeno', name: 'Jalapeños', additional_price: 0.75, is_available: false },
  ],
};

describe('money', () => {
  it('converts numerics to integer cents and formats USD', () => {
    expect(toCents('12.50')).toBe(1250);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(null)).toBe(0);
    expect(formatMoney('42.94')).toBe('$42.94');
    expect(formatCents(-425)).toBe('−$4.25');
  });

  it('reproduces the design’s fee math (service 4%, promo 10%)', () => {
    const subtotal = 4250;
    const service = percentOf(subtotal, SERVICE_FEE_RATE);
    const discount = percentOf(subtotal, 0.1);
    expect([service, discount, subtotal + 299 + service - discount]).toEqual([170, 425, 4294]);
    // After removing Hot Wings: $33.50 → $34.48
    expect(3350 + 299 + percentOf(3350, SERVICE_FEE_RATE) - percentOf(3350, 0.1)).toBe(3448);
  });
});

describe('dish options', () => {
  it('requires required groups and caps multiple-choice groups', () => {
    expect(selectionErrors([bun, addons], [])).toEqual({ bun: 'Pick one in “Choose bun”' });
    expect(selectionErrors([bun, addons], ['brioche', 'bacon'])).toEqual({});
    expect(selectionErrors([bun, addons], ['brioche', 'jalapeno'])).toEqual({ addons: 'An option in “Add-ons” is sold out' });
  });

  it('toggles single choices by replacement and multiple choices up to the maximum', () => {
    expect(toggleValue([bun, addons], ['brioche'], 'potato')).toEqual(['potato']);
    expect(toggleValue([bun, addons], ['bacon', 'cheese'], 'jalapeno')).toEqual(['bacon', 'cheese']);
    expect(toggleValue([bun, addons], ['bacon', 'cheese'], 'bacon')).toEqual(['cheese']);
  });

  it('prices a configured dish: 2 × (12.50 + bacon 1.50) = 28.00', () => {
    expect(unitPriceCents('12.50', [bun, addons], ['brioche', 'bacon']) * 2).toBe(2800);
  });

  it('preselects only an unambiguous required choice', () => {
    expect(defaultSelection([bun, addons])).toEqual([]);
    expect(defaultSelection([{ ...bun, values: [bun.values[0]] }])).toEqual(['brioche']);
  });
});

describe('order lifecycle', () => {
  it('matches the database state machine', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('preparing', 'cancelled')).toBe(false);
    expect(TRANSITIONS.delivered).toEqual([]);
    expect(customerCanCancel('pending')).toBe(true);
    expect(customerCanCancel('confirmed')).toBe(false);
    expect(isActive('out_for_delivery')).toBe(true);
    expect(TRACK_STEPS.filter((s) => s.reached('out_for_delivery')).map((s) => s.label)).toEqual(['Placed', 'Preparing', 'On the way']);
  });

  it('estimates arrival from the restaurant’s stated window, or the scheduled time', () => {
    expect(estimatedArrival('2026-10-29T19:12:00Z', 30, null).toISOString()).toBe('2026-10-29T19:42:00.000Z');
    expect(estimatedArrival('2026-10-29T19:12:00Z', 30, '2026-10-30T12:00:00Z').toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });
});

describe('validation', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  it('limits quantities and accepts seeded (non-RFC) catalog ids', () => {
    expect(addToCartSchema.safeParse({ foodItemId: 'c3a2f1e0-8d5f-31b1-a4f3-9c6a8f1b2d3e', quantity: 2, optionValueIds: [], replace: false }).success).toBe(true);
    expect(addToCartSchema.safeParse({ foodItemId: uuid, quantity: 0, optionValueIds: [], replace: false }).success).toBe(false);
    expect(addToCartSchema.safeParse({ foodItemId: uuid, quantity: 21, optionValueIds: [], replace: false }).success).toBe(false);
  });

  it('normalises promo codes and validates addresses and schedule windows', () => {
    expect(promoSchema.parse({ code: ' welcome10 ' }).code).toBe('WELCOME10');
    expect(promoSchema.safeParse({ code: 'no!' }).success).toBe(false);
    const addr = { id: null, label: 'home', recipientName: 'Ziah', phone: '+1 (512) 555-0148', addressLine: '214 Maple Ave', unit: '', city: 'Austin', postalCode: '78704', deliveryInstructions: '', isDefault: true };
    expect(addressSchema.safeParse(addr).success).toBe(true);
    expect(addressSchema.safeParse({ ...addr, phone: 'call me' }).success).toBe(false);
    const base = { addressId: uuid, paymentMethod: 'demo_card', idempotencyKey: uuid, instructions: null };
    expect(checkoutSchema.safeParse({ ...base, scheduledFor: null }).success).toBe(true);
    expect(checkoutSchema.safeParse({ ...base, scheduledFor: new Date(Date.now() + 5 * 60_000).toISOString() }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, paymentMethod: 'bank_transfer', scheduledFor: null }).success).toBe(false);
  });
});
