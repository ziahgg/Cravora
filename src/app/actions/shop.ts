'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { dbFail, fail, invalid, ok, type ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/supabase/server';
import { addressSchema, addToCartSchema, checkoutSchema, id, profileSchema, promoSchema, quantitySchema, reviewSchema } from '@/lib/validations';
import type { OrderStatus } from '@/types/database';

/** Messages raised by the ordering functions (errcode 22023) are written for customers and safe to show. */
function orderFail(where: string, error: { code?: string; message: string }): ActionResult<never> {
  if (error.code === '22023' || error.code === 'P0002') return fail(error.message);
  if (error.code === '42501' && /restaurant/i.test(error.message)) return fail(error.message);
  return dbFail(where, error);
}

// ───────────── Cart ─────────────

export async function addToCart(input: z.input<typeof addToCartSchema>): Promise<ActionResult<{ status: 'added' | 'conflict'; count: number; currentRestaurant?: string }>> {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const v = parsed.data;
  const { data, error } = await supabase.rpc('cart_add', { p_item: v.foodItemId, p_quantity: v.quantity, p_option_values: v.optionValueIds, p_replace: v.replace });
  if (error) return dbFail('cart_add', error);
  if (data.status === 'invalid') return fail(data.message ?? 'This dish can’t be added right now.');
  revalidatePath('/', 'layout');
  return ok({ status: data.status, count: data.count ?? 0, currentRestaurant: data.current_restaurant });
}

export async function setCartQuantity(input: z.input<typeof quantitySchema>): Promise<ActionResult> {
  const parsed = quantitySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { cartItemId, quantity } = parsed.data;
  const res = quantity === 0
    ? await supabase.from('cart_items').delete({ count: 'exact' }).eq('id', cartItemId).eq('user_id', userId)
    : await supabase.from('cart_items').update({ quantity }, { count: 'exact' }).eq('id', cartItemId).eq('user_id', userId);
  if (res.error) return dbFail('setCartQuantity', res.error);
  if (!res.count) return fail('That item is no longer in your cart.');
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function clearCart(): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId);
  if (error) return dbFail('clearCart', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function setPromoCode(input: z.input<typeof promoSchema>): Promise<ActionResult> {
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { error, count } = await supabase.from('carts').update({ promo_code: parsed.data.code }, { count: 'exact' }).eq('user_id', userId);
  if (error) return dbFail('setPromoCode', error);
  if (!count) return fail('Add something to your cart first.');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  return ok(undefined);
}

// ───────────── Checkout & orders ─────────────

/** Totals are computed in place_order() from database prices; the client sends no amounts. */
export async function placeOrder(input: z.input<typeof checkoutSchema>): Promise<ActionResult<{ orderId: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await requireUser();
  const v = parsed.data;
  const { data, error } = await supabase.rpc('place_order', {
    p_address_id: v.addressId,
    p_payment_method: v.paymentMethod,
    p_idempotency_key: v.idempotencyKey,
    p_scheduled_for: v.scheduledFor,
    p_instructions: v.instructions,
  });
  if (error) return orderFail('place_order', error);
  revalidatePath('/', 'layout');
  return ok({ orderId: data });
}

export async function cancelOrder(orderId: string): Promise<ActionResult> {
  if (!id.safeParse(orderId).success) return fail('Order not found.');
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_status: 'cancelled', p_note: null });
  if (error) return orderFail('cancelOrder', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}

export async function reorder(orderId: string): Promise<ActionResult<{ added: number; skipped: number }>> {
  if (!id.safeParse(orderId).success) return fail('Order not found.');
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('reorder', { p_order_id: orderId });
  if (error) return orderFail('reorder', error);
  revalidatePath('/', 'layout');
  return ok(data);
}

export async function submitReview(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { data: order } = await supabase.from('orders').select('restaurant_id, status').eq('id', parsed.data.orderId).maybeSingle();
  if (!order?.restaurant_id || order.status !== 'delivered') return fail('You can rate an order once it’s delivered.');
  const { error } = await supabase.from('reviews').insert({ order_id: parsed.data.orderId, user_id: userId, restaurant_id: order.restaurant_id, rating: parsed.data.rating, comment: parsed.data.comment });
  if (error) return error.code === '23505' ? fail('You’ve already rated this order.') : dbFail('submitReview', error);
  revalidatePath(`/orders/${parsed.data.orderId}`);
  return ok(undefined);
}

/** Restaurant owners/admins: move an order through the state machine (enforced in the database). */
export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult> {
  if (!id.safeParse(orderId).success) return fail('Order not found.');
  if (!['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)) return fail('Invalid status.');
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('update_order_status', { p_order_id: orderId, p_status: status, p_note: note?.slice(0, 200) ?? null });
  if (error) return orderFail('updateOrderStatus', error);
  revalidatePath('/restaurant/orders');
  revalidatePath(`/orders/${orderId}`);
  return ok(undefined);
}

// ───────────── Favorites ─────────────

export async function setFavorite(kind: 'restaurant' | 'dish', targetId: string, on: boolean): Promise<ActionResult> {
  if (!id.safeParse(targetId).success) return fail('Not found.');
  const { supabase, userId } = await requireUser();
  const res =
    kind === 'restaurant'
      ? on
        ? await supabase.from('favorite_restaurants').upsert({ user_id: userId, restaurant_id: targetId }, { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true })
        : await supabase.from('favorite_restaurants').delete().eq('user_id', userId).eq('restaurant_id', targetId)
      : on
        ? await supabase.from('favorite_items').upsert({ user_id: userId, food_item_id: targetId }, { onConflict: 'user_id,food_item_id', ignoreDuplicates: true })
        : await supabase.from('favorite_items').delete().eq('user_id', userId).eq('food_item_id', targetId);
  if (res.error) return dbFail('setFavorite', res.error);
  revalidatePath('/favorites');
  return ok(undefined);
}

// ───────────── Addresses & profile ─────────────

export async function saveAddress(input: z.input<typeof addressSchema>): Promise<ActionResult<{ id: string }>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const v = parsed.data;
  const row = { label: v.label, recipient_name: v.recipientName, phone: v.phone, address_line: v.addressLine, unit: v.unit, city: v.city, postal_code: v.postalCode, delivery_instructions: v.deliveryInstructions };
  let addressId = v.id;
  if (addressId) {
    const { error, count } = await supabase.from('addresses').update(row, { count: 'exact' }).eq('id', addressId).eq('user_id', userId);
    if (error) return dbFail('updateAddress', error);
    if (!count) return fail('That address no longer exists.');
  } else {
    const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const { data, error } = await supabase.from('addresses').insert({ ...row, user_id: userId, is_default: !count }).select('id').single();
    if (error) return dbFail('createAddress', error);
    addressId = data.id;
  }
  if (v.isDefault) {
    const { error } = await supabase.rpc('set_default_address', { p_address_id: addressId });
    if (error) return dbFail('setDefault', error);
  }
  revalidatePath('/addresses');
  revalidatePath('/checkout');
  return ok({ id: addressId });
}

export async function deleteAddress(addressId: string): Promise<ActionResult> {
  if (!id.safeParse(addressId).success) return fail('Address not found.');
  const { supabase, userId } = await requireUser();
  const { error, count } = await supabase.from('addresses').delete({ count: 'exact' }).eq('id', addressId).eq('user_id', userId);
  if (error) return dbFail('deleteAddress', error);
  if (!count) return fail('Address not found.');
  revalidatePath('/addresses');
  return ok(undefined);
}

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase, userId } = await requireUser();
  const { error } = await supabase.from('profiles').update({ display_name: parsed.data.displayName, phone: parsed.data.phone }).eq('id', userId);
  if (error) return dbFail('updateProfile', error);
  revalidatePath('/profile');
  return ok(undefined);
}

export async function updatePreference(key: 'order_updates' | 'promo_offers', value: boolean): Promise<ActionResult> {
  if (key !== 'order_updates' && key !== 'promo_offers') return fail('Invalid setting.');
  const { supabase, userId } = await requireUser();
  const patch = key === 'order_updates' ? { order_updates: value } : { promo_offers: value };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) return dbFail('updatePreference', error);
  revalidatePath('/profile');
  return ok(undefined);
}

export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const { supabase, userId } = await requireUser();
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids?.length) q = q.in('id', ids.filter((x) => id.safeParse(x).success));
  const { error } = await q;
  if (error) return dbFail('markRead', error);
  revalidatePath('/', 'layout');
  return ok(undefined);
}
