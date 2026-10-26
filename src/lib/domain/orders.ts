import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/database';

/** Mirrors public.order_transition_allowed() — the database enforces it; the UI uses it to show buttons. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);
export const isActive = (s: OrderStatus) => s !== 'delivered' && s !== 'cancelled';
export const customerCanCancel = (s: OrderStatus) => s === 'pending';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Four-step tracker from the design: Placed → Preparing → On the way → Delivered. */
export const TRACK_STEPS: { key: string; label: string; reached: (s: OrderStatus) => boolean }[] = [
  { key: 'placed', label: 'Placed', reached: (s) => s !== 'cancelled' },
  { key: 'preparing', label: 'Preparing', reached: (s) => ['confirmed', 'preparing', 'out_for_delivery', 'delivered'].includes(s) },
  { key: 'way', label: 'On the way', reached: (s) => ['out_for_delivery', 'delivered'].includes(s) },
  { key: 'delivered', label: 'Delivered', reached: (s) => s === 'delivered' },
];

export const HISTORY_TITLE: Record<OrderStatus, string> = {
  pending: 'Order placed',
  confirmed: 'Restaurant confirmed',
  preparing: 'Food being prepared',
  out_for_delivery: 'Courier on the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Owner-side action labels for each forward transition. */
export const NEXT_ACTION: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'confirmed', label: 'Accept order' },
  confirmed: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'out_for_delivery', label: 'Hand to courier' },
  out_for_delivery: { to: 'delivered', label: 'Mark delivered' },
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash_on_delivery: 'Cash on delivery',
  demo_card: 'Demo card (no charge)',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  due_on_delivery: 'Pay the courier on delivery',
  paid: 'Paid in cash on delivery',
  demo_authorized: 'Demo payment — nothing was charged',
  demo_voided: 'Demo payment voided — nothing was charged',
  not_charged: 'Not charged',
};

/** "Arriving around 7:42 PM" uses the restaurant's stated upper estimate — not live tracking. */
export function estimatedArrival(placedAt: string, etaMaxMinutes: number, scheduledFor: string | null): Date {
  return scheduledFor ? new Date(scheduledFor) : new Date(new Date(placedAt).getTime() + etaMaxMinutes * 60_000);
}
