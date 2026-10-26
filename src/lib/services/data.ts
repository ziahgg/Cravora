import 'server-only';

import { cache } from 'react';

import { createClient, type ServerClient } from '@/lib/supabase/server';
import type {
  AddressRow,
  CartQuote,
  CategoryRow,
  FoodItemRow,
  NotificationRow,
  OptionRow,
  OptionValueRow,
  OrderHistoryRow,
  OrderItemRow,
  OrderRow,
  ProfileRow,
  RestaurantRow,
  ReviewRow,
} from '@/types/database';

/**
 * Read services. Queries run as the visitor: anonymous users see only the public catalog; signed-in
 * users additionally see their own rows (RLS). Errors are logged without row data.
 */
export class DataError extends Error {}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    console.error(`[cravora] ${what} failed: ${res.error.code ?? ''} ${res.error.message}`);
    throw new DataError(`Couldn’t load ${what}.`);
  }
  return res.data as T;
}

/** Visitor for public pages: a client plus the user id when signed in (JWT verified by getClaims). */
export const viewer = cache(async (): Promise<{ db: ServerClient; userId: string | null }> => {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const sub = data?.claims?.sub;
  return { db, userId: typeof sub === 'string' ? sub : null };
});

// ───────────── Catalog ─────────────

export type RestaurantCard = RestaurantRow & { rating: number | null; review_count: number };

export interface RestaurantFilters {
  q?: string;
  cuisine?: string | null;
  tag?: string | null;
  maxEta?: number | null;
  minRating?: number | null;
  sort?: 'recommended' | 'rating' | 'eta' | 'delivery_fee';
  ids?: string[];
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_,()]/g, ' ').trim().slice(0, 60);
}

export async function listRestaurants(db: ServerClient, f: RestaurantFilters = {}): Promise<RestaurantCard[]> {
  let q = db.from('restaurants').select('*').eq('is_active', true).limit(60);
  if (f.cuisine) q = q.eq('cuisine', f.cuisine);
  if (f.tag) q = q.contains('tags', [f.tag]);
  if (f.maxEta) q = q.lte('eta_max_minutes', f.maxEta);
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000']);
  if (f.q) {
    const term = escapeLike(f.q);
    // Restaurants matching by name/cuisine, or serving a dish whose name matches.
    const dishes = check(await db.from('food_items').select('restaurant_id').ilike('name', `%${term}%`).limit(200), 'search');
    const ids = [...new Set(dishes.map((d) => d.restaurant_id))];
    q = q.or([`name.ilike.%${term}%`, `cuisine.ilike.%${term}%`, ...(ids.length ? [`id.in.(${ids.join(',')})`] : [])].join(','));
  }
  const rows = check(await q, 'restaurants');
  const ratings = await ratingsFor(db, rows.map((r) => r.id));
  let out: RestaurantCard[] = rows.map((r) => ({ ...r, rating: ratings.get(r.id)?.rating ?? null, review_count: ratings.get(r.id)?.count ?? 0 }));
  if (f.minRating) out = out.filter((r) => (r.rating ?? 0) >= (f.minRating ?? 0));
  const sort = f.sort ?? 'recommended';
  out.sort((a, b) =>
    sort === 'eta'
      ? a.eta_max_minutes - b.eta_max_minutes
      : sort === 'delivery_fee'
        ? Number(a.delivery_fee) - Number(b.delivery_fee)
        : sort === 'rating'
          ? (b.rating ?? 0) - (a.rating ?? 0)
          : (b.rating ?? 0) * Math.log2(2 + b.review_count) - (a.rating ?? 0) * Math.log2(2 + a.review_count),
  );
  return out;
}

async function ratingsFor(db: ServerClient, ids: string[]): Promise<Map<string, { rating: number; count: number }>> {
  if (!ids.length) return new Map();
  const rows = check(await db.from('restaurant_ratings').select('*').in('restaurant_id', ids), 'ratings');
  return new Map(rows.map((r) => [r.restaurant_id, { rating: Number(r.rating), count: r.review_count }]));
}

export async function cuisines(db: ServerClient): Promise<{ cuisine: string; image_key: string | null }[]> {
  const rows = check(await db.from('restaurants').select('cuisine, image_key').eq('is_active', true), 'cuisines');
  const map = new Map<string, string | null>();
  for (const r of rows) if (!map.has(r.cuisine)) map.set(r.cuisine, r.image_key);
  return [...map].map(([cuisine, image_key]) => ({ cuisine, image_key }));
}

export type MenuItem = FoodItemRow & { options: (OptionRow & { values: OptionValueRow[] })[] };

async function optionsFor(db: ServerClient, itemIds: string[]): Promise<Map<string, MenuItem['options']>> {
  const out = new Map<string, MenuItem['options']>();
  if (!itemIds.length) return out;
  const opts = check(await db.from('food_item_options').select('*').in('food_item_id', itemIds).order('sort_order'), 'options');
  const vals = opts.length ? check(await db.from('food_item_option_values').select('*').in('option_id', opts.map((o) => o.id)).order('sort_order'), 'options') : [];
  for (const o of opts) {
    const list = out.get(o.food_item_id) ?? [];
    list.push({ ...o, values: vals.filter((v) => v.option_id === o.id) });
    out.set(o.food_item_id, list);
  }
  return out;
}

export async function getRestaurant(db: ServerClient, slug: string): Promise<{ restaurant: RestaurantCard; categories: CategoryRow[]; items: MenuItem[] } | null> {
  const r: RestaurantRow | null = check(await db.from('restaurants').select('*').eq('slug', slug).maybeSingle(), 'this restaurant');
  if (!r) return null;
  const [categories, items, ratings] = await Promise.all([
    db.from('food_categories').select('*').eq('restaurant_id', r.id).eq('is_active', true).order('sort_order').then((x) => check(x, 'menu')),
    db.from('food_items').select('*').eq('restaurant_id', r.id).order('name').then((x) => check(x, 'menu')),
    ratingsFor(db, [r.id]),
  ]);
  const opts = await optionsFor(db, items.map((i) => i.id));
  return {
    restaurant: { ...r, rating: ratings.get(r.id)?.rating ?? null, review_count: ratings.get(r.id)?.count ?? 0 },
    categories,
    items: items.map((i) => ({ ...i, options: opts.get(i.id) ?? [] })),
  };
}

export async function getDish(db: ServerClient, id: string): Promise<{ item: MenuItem; restaurant: RestaurantRow } | null> {
  const item: FoodItemRow | null = check(await db.from('food_items').select('*').eq('id', id).maybeSingle(), 'this dish');
  if (!item) return null;
  const restaurant: RestaurantRow | null = check(await db.from('restaurants').select('*').eq('id', item.restaurant_id).maybeSingle(), 'this dish');
  if (!restaurant) return null;
  const opts = await optionsFor(db, [item.id]);
  return { item: { ...item, options: opts.get(item.id) ?? [] }, restaurant };
}

export type DishCard = FoodItemRow & { restaurant: Pick<RestaurantRow, 'name' | 'slug' | 'eta_min_minutes' | 'eta_max_minutes'>; has_options: boolean };

export async function searchDishes(db: ServerClient, q: string, opts: { maxEta?: number | null; ids?: string[] } = {}): Promise<DishCard[]> {
  let query = db.from('food_items').select('*').eq('is_available', true).limit(60);
  if (q) query = query.ilike('name', `%${escapeLike(q)}%`);
  if (opts.ids) query = query.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000']);
  const items = check(await query, 'dishes');
  if (!items.length) return [];
  const rs = check(await db.from('restaurants').select('*').in('id', [...new Set(items.map((i) => i.restaurant_id))]).eq('is_active', true), 'dishes');
  const byId = new Map(rs.map((r) => [r.id, r]));
  const withOpts = new Set(check(await db.from('food_item_options').select('food_item_id').in('food_item_id', items.map((i) => i.id)), 'dishes').map((o) => o.food_item_id));
  return items.flatMap((i) => {
    const r = byId.get(i.restaurant_id);
    if (!r || (opts.maxEta && r.eta_max_minutes > opts.maxEta)) return [];
    return [{ ...i, restaurant: { name: r.name, slug: r.slug, eta_min_minutes: r.eta_min_minutes, eta_max_minutes: r.eta_max_minutes }, has_options: withOpts.has(i.id) }];
  });
}

/** Popular dishes as flagged by restaurants (`is_popular`) — editorial, not personalised. */
export async function trendingDishes(db: ServerClient, limit = 3): Promise<DishCard[]> {
  const popular = check(await db.from('food_items').select('id').eq('is_popular', true).eq('is_available', true).limit(20), 'trending');
  const ranked = await searchDishes(db, '', { ids: popular.map((p) => p.id) });
  return ranked.slice(0, limit);
}

// ───────────── Customer ─────────────

export async function favoriteIds(db: ServerClient, userId: string | null): Promise<{ restaurants: Set<string>; items: Set<string> }> {
  if (!userId) return { restaurants: new Set(), items: new Set() };
  const [r, i] = await Promise.all([
    db.from('favorite_restaurants').select('restaurant_id, created_at').eq('user_id', userId).then((x) => check(x, 'favorites')),
    db.from('favorite_items').select('food_item_id, created_at').eq('user_id', userId).then((x) => check(x, 'favorites')),
  ]);
  return { restaurants: new Set(r.map((x) => x.restaurant_id)), items: new Set(i.map((x) => x.food_item_id)) };
}

export async function quoteCart(db: ServerClient): Promise<CartQuote> {
  return check(await db.rpc('quote_cart'), 'your cart');
}

export async function cartCount(db: ServerClient, userId: string | null): Promise<number> {
  if (!userId) return 0;
  const rows = check(await db.from('cart_items').select('quantity').eq('user_id', userId), 'your cart');
  return rows.reduce((s, r) => s + r.quantity, 0);
}

export async function getProfile(db: ServerClient, userId: string): Promise<ProfileRow | null> {
  return check(await db.from('profiles').select('*').eq('id', userId).maybeSingle(), 'your profile');
}

export async function listAddresses(db: ServerClient, userId: string): Promise<AddressRow[]> {
  return check(await db.from('addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }).order('created_at'), 'your addresses');
}

export type OrderSummary = OrderRow & { items: Pick<OrderItemRow, 'item_name_snapshot' | 'quantity'>[] };

export async function listOrders(db: ServerClient, userId: string, limit = 50): Promise<OrderSummary[]> {
  const orders = check(await db.from('orders').select('*').eq('user_id', userId).order('placed_at', { ascending: false }).limit(limit), 'your orders');
  if (!orders.length) return [];
  const items = check(await db.from('order_items').select('order_id, item_name_snapshot, quantity, created_at').in('order_id', orders.map((o) => o.id)), 'your orders');
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}

export type OrderDetail = OrderRow & { items: OrderItemRow[]; history: OrderHistoryRow[]; review: ReviewRow | null };

export async function getOrder(db: ServerClient, id: string): Promise<OrderDetail | null> {
  const o: OrderRow | null = check(await db.from('orders').select('*').eq('id', id).maybeSingle(), 'this order');
  if (!o) return null;
  const [items, history, review] = await Promise.all([
    db.from('order_items').select('*').eq('order_id', id).order('created_at').then((x) => check(x, 'this order')),
    db.from('order_status_history').select('*').eq('order_id', id).order('created_at').then((x) => check(x, 'this order')),
    db.from('reviews').select('*').eq('order_id', id).maybeSingle().then((x): ReviewRow | null => check(x, 'this order')),
  ]);
  return { ...o, items, history, review };
}

export async function listNotifications(db: ServerClient, userId: string): Promise<NotificationRow[]> {
  return check(await db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(60), 'notifications');
}

export async function unreadCount(db: ServerClient, userId: string | null): Promise<number> {
  if (!userId) return 0;
  const res = await db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  return res.error ? 0 : (res.count ?? 0);
}

export async function isRestaurantOwner(db: ServerClient, userId: string): Promise<boolean> {
  const rows = check(await db.from('user_roles').select('role').eq('user_id', userId), 'your roles');
  return rows.some((r) => r.role === 'restaurant_owner' || r.role === 'admin');
}

// ───────────── Restaurant owner ─────────────

/** Restaurants the user manages (RLS + can_manage_restaurant decide). */
export async function managedRestaurants(db: ServerClient, userId: string): Promise<RestaurantRow[]> {
  if (!(await isRestaurantOwner(db, userId))) return [];
  return check(await db.from('restaurants').select('*').eq('owner_user_id', userId).order('name'), 'your restaurants');
}

export async function restaurantOrders(db: ServerClient, restaurantIds: string[]): Promise<OrderSummary[]> {
  if (!restaurantIds.length) return [];
  const orders = check(await db.from('orders').select('*').in('restaurant_id', restaurantIds).order('placed_at', { ascending: false }).limit(100), 'orders');
  if (!orders.length) return [];
  const items = check(await db.from('order_items').select('order_id, item_name_snapshot, quantity').in('order_id', orders.map((o) => o.id)), 'orders');
  return orders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
}
