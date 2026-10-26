import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

import { asUser, createDb, createUser } from './harness';

/**
 * Integration tests against the real migrations (in-process Postgres with a Supabase auth stub).
 * Fixture mirrors the Figma order: 2× Double Smash + bacon $28.00, Truffle Fries $5.50, Hot Wings $9.00.
 */
const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const OWNER = '33333333-3333-4333-8333-333333333333';
const OWNER2 = '44444444-4444-4444-8444-444444444444';

const R1 = 'a0000000-0000-4000-8000-000000000001';
const R2 = 'a0000000-0000-4000-8000-000000000002';
const SMASH = 'b0000000-0000-4000-8000-000000000001';
const FRIES = 'b0000000-0000-4000-8000-000000000002';
const WINGS = 'b0000000-0000-4000-8000-000000000003';
const RAMEN = 'b0000000-0000-4000-8000-000000000004';
const BUN = 'c0000000-0000-4000-8000-000000000001';
const ADDONS = 'c0000000-0000-4000-8000-000000000002';
const BRIOCHE = 'd0000000-0000-4000-8000-000000000001';
const POTATO = 'd0000000-0000-4000-8000-000000000002';
const BACON = 'd0000000-0000-4000-8000-000000000003';
const RAMEN_ONLY_VALUE = 'd0000000-0000-4000-8000-000000000009';

let db: PGlite;
let address: string;
let otherAddress: string;

const one = async <T>(p: Promise<{ rows: T[] }>) => (await p).rows[0];
const quote = (uid: string) => asUser(db, uid, async (tx) => (await one(tx.query<{ q: Record<string, unknown> }>('select quote_cart() q'))).q);
const add = (uid: string, item: string, qty: number, opts: string[] = [], replace = false) =>
  asUser(db, uid, async (tx) => (await one(tx.query<{ r: { status: string; message?: string } }>('select cart_add($1, $2, $3::uuid[], $4) r', [item, qty, opts, replace]))).r);
const place = (uid: string, addr: string, key: string, method = 'demo_card') =>
  asUser(db, uid, async (tx) => (await one(tx.query<{ id: string }>('select place_order($1, $2, $3) id', [addr, method, key]))).id);
const setStatus = (uid: string, order: string, status: string, note?: string) => asUser(db, uid, (tx) => tx.query('select update_order_status($1, $2, $3)', [order, status, note ?? null]));

beforeAll(async () => {
  db = await createDb();
  for (const [id, name] of [[CUSTOMER, 'Ziah'], [OTHER, 'Other'], [OWNER, 'Owner'], [OWNER2, 'Owner Two']]) await createUser(db, id, name);
  await db.exec(`
    insert into user_roles values ('${OWNER}', 'restaurant_owner'), ('${OWNER2}', 'restaurant_owner');
    insert into restaurants (id, owner_user_id, name, slug, cuisine, delivery_fee, min_order) values
      ('${R1}', '${OWNER}', 'Stack & Smoke Burgers', 'stack-smoke', 'American', 2.99, 10),
      ('${R2}', '${OWNER2}', 'Kintsugi Ramen', 'kintsugi', 'Japanese', 1.99, 12);
    insert into food_categories (id, restaurant_id, name, slug) values
      ('e0000000-0000-4000-8000-000000000001', '${R1}', 'Burgers', 'burgers'),
      ('e0000000-0000-4000-8000-000000000002', '${R2}', 'Ramen', 'ramen');
    insert into food_items (id, restaurant_id, category_id, name, slug, price) values
      ('${SMASH}', '${R1}', 'e0000000-0000-4000-8000-000000000001', 'Double Smash Cheeseburger', 'double-smash', 12.50),
      ('${FRIES}', '${R1}', 'e0000000-0000-4000-8000-000000000001', 'Truffle Parmesan Fries', 'fries', 5.50),
      ('${WINGS}', '${R1}', 'e0000000-0000-4000-8000-000000000001', 'Hot Wings (6 pcs)', 'wings', 9.00),
      ('${RAMEN}', '${R2}', 'e0000000-0000-4000-8000-000000000002', 'Tonkotsu Ramen', 'tonkotsu', 15.00);
    insert into food_item_options (id, food_item_id, name, selection_type, is_required, min_selections, max_selections) values
      ('${BUN}', '${SMASH}', 'Choose bun', 'single', true, 1, 1),
      ('${ADDONS}', '${SMASH}', 'Add-ons', 'multiple', false, 0, 2),
      ('c0000000-0000-4000-8000-000000000009', '${RAMEN}', 'Spice', 'single', false, 0, 1);
    insert into food_item_option_values (id, option_id, name, additional_price) values
      ('${BRIOCHE}', '${BUN}', 'Brioche', 0), ('${POTATO}', '${BUN}', 'Potato bun', 0), ('${BACON}', '${ADDONS}', 'Smoked bacon', 1.50),
      ('${RAMEN_ONLY_VALUE}', 'c0000000-0000-4000-8000-000000000009', 'Hot', 0);
    insert into promotions (code, description, percent_off, min_subtotal, first_order_only) values ('WELCOME10', '10% off your first order', 10, 15, true);
  `);
  address = await asUser(db, CUSTOMER, async (tx) =>
    (await one(tx.query<{ id: string }>(`insert into addresses (user_id, recipient_name, phone, address_line, city, postal_code, is_default) values ($1, 'Ziah', '+1 512 555 0148', '214 Maple Ave', 'Austin', '78704', true) returning id`, [CUSTOMER]))).id,
  );
  otherAddress = await asUser(db, OTHER, async (tx) =>
    (await one(tx.query<{ id: string }>(`insert into addresses (user_id, recipient_name, phone, address_line, city, postal_code) values ($1, 'Other', '+1 512 555 0100', '1 Elm St', 'Austin', '78701') returning id`, [OTHER]))).id,
  );
}, 60_000);

describe('public catalog', () => {
  it('lets anonymous visitors read active restaurants and menus, but not private data', async () => {
    const n = await asUser(db, null, async (tx) => (await one(tx.query<{ n: number }>('select count(*)::int n from food_items'))).n);
    expect(n).toBe(4);
    await expect(asUser(db, null, (tx) => tx.query('select * from addresses'))).rejects.toThrow(/permission denied/);
    const orders = await asUser(db, null, async (tx) => (await tx.query('select * from orders')).rows.length);
    expect(orders).toBe(0);
  });

  it('hides inactive restaurants from customers but not from their owner', async () => {
    await db.exec(`update restaurants set is_active = false where id = '${R2}'`);
    const customer = await asUser(db, CUSTOMER, async (tx) => (await tx.query('select id from restaurants')).rows.length);
    const owner2 = await asUser(db, OWNER2, async (tx) => (await tx.query('select id from restaurants')).rows.length);
    await db.exec(`update restaurants set is_active = true where id = '${R2}'`);
    expect(customer).toBe(1);
    expect(owner2).toBe(2);
  });
});

describe('cart', () => {
  it('validates required, maximum and foreign option selections', async () => {
    expect(await add(CUSTOMER, SMASH, 1, [])).toMatchObject({ status: 'invalid', message: expect.stringContaining('Choose bun') });
    expect(await add(CUSTOMER, SMASH, 1, [BRIOCHE, POTATO])).toMatchObject({ status: 'invalid', message: expect.stringContaining('at most 1') });
    expect(await add(CUSTOMER, SMASH, 1, [BRIOCHE, RAMEN_ONLY_VALUE])).toMatchObject({ status: 'invalid', message: expect.stringContaining('isn’t offered') });
    expect(await add(CUSTOMER, SMASH, 21, [BRIOCHE])).toMatchObject({ status: 'invalid' });
  });

  it('merges identical configurations and prices options from the database', async () => {
    expect(await add(CUSTOMER, SMASH, 1, [BACON, BRIOCHE])).toMatchObject({ status: 'added' });
    expect(await add(CUSTOMER, SMASH, 1, [BRIOCHE, BACON])).toMatchObject({ status: 'added' });
    await add(CUSTOMER, FRIES, 1);
    await add(CUSTOMER, WINGS, 1);
    const q = await quote(CUSTOMER);
    expect(q.items).toHaveLength(3);
    expect(q).toMatchObject({ subtotal: 42.5, delivery_fee: 2.99, service_fee: 1.7, discount: 0, total: 47.19, count: 4 });
  });

  it('refuses to mix restaurants unless the customer chooses to start a new cart', async () => {
    expect(await add(CUSTOMER, RAMEN, 1)).toMatchObject({ status: 'conflict' });
    expect((await quote(CUSTOMER)).count).toBe(4);
  });

  it('applies a valid promo code server-side and reports invalid ones', async () => {
    await asUser(db, CUSTOMER, (tx) => tx.query(`update carts set promo_code = 'WELCOME10' where user_id = $1`, [CUSTOMER]));
    expect(await quote(CUSTOMER)).toMatchObject({ discount: 4.25, total: 42.94, promo: { applied: true } });
  });

  it('does not let customers write prices, cart rows or other users’ carts directly', async () => {
    // RLS turns a customer's price update into a no-op (0 rows), and the price stays put.
    const changed = await asUser(db, CUSTOMER, async (tx) => (await tx.query(`update food_items set price = 0.01 where id = $1`, [SMASH])).affectedRows ?? 0);
    expect(changed).toBe(0);
    expect(await asUser(db, null, async (tx) => (await one(tx.query<{ price: string }>('select price from food_items where id = $1', [SMASH]))).price)).toBe('12.50');
    await expect(asUser(db, CUSTOMER, (tx) => tx.query(`insert into cart_items (user_id, food_item_id, quantity) values ($1, $2, 1)`, [CUSTOMER, FRIES]))).rejects.toThrow(/permission denied/);
    const n = await asUser(db, OTHER, async (tx) => (await tx.query(`update cart_items set quantity = 9 where user_id = $1`, [CUSTOMER])).affectedRows ?? 0);
    expect(n).toBe(0);
  });
});

describe('placing orders', () => {
  let orderId: string;
  const key = '99999999-9999-4999-8999-999999999991';

  it('creates the order with snapshots and totals from the database, then clears the cart', async () => {
    orderId = await place(CUSTOMER, address, key);
    const o = await asUser(db, CUSTOMER, (tx) =>
      one(tx.query<Record<string, unknown>>('select order_number, status, payment_status, subtotal, delivery_fee, service_fee, discount_amount, total_amount, promo_code, customer_name_snapshot from orders where id = $1', [orderId])),
    );
    expect(o).toMatchObject({ status: 'pending', payment_status: 'demo_authorized', subtotal: '42.50', delivery_fee: '2.99', service_fee: '1.70', discount_amount: '4.25', total_amount: '42.94', promo_code: 'WELCOME10', customer_name_snapshot: 'Ziah' });
    expect(String(o.order_number)).toMatch(/^CRV-\d+$/);
    const items = await asUser(db, CUSTOMER, async (tx) => (await tx.query<{ item_name_snapshot: string; unit_price_snapshot: string; quantity: number; line_total: string }>('select item_name_snapshot, unit_price_snapshot, quantity, line_total from order_items where order_id = $1 order by line_total desc', [orderId])).rows);
    expect(items[0]).toMatchObject({ item_name_snapshot: 'Double Smash Cheeseburger', unit_price_snapshot: '14.00', quantity: 2, line_total: '28.00' });
    expect((await quote(CUSTOMER)).count).toBe(0);
  });

  it('keeps order snapshots when the menu price changes later', async () => {
    await db.exec(`update food_items set price = 99 where id = '${SMASH}'`);
    const t = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ total_amount: string }>('select total_amount from orders where id = $1', [orderId]))).total_amount);
    await db.exec(`update food_items set price = 12.50 where id = '${SMASH}'`);
    expect(t).toBe('42.94');
  });

  it('returns the same order for a repeated submission (idempotency)', async () => {
    expect(await place(CUSTOMER, address, key)).toBe(orderId);
    const n = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ n: number }>('select count(*)::int n from orders'))).n);
    expect(n).toBe(1);
  });

  it('blocks reusing a first-order promo', async () => {
    await add(CUSTOMER, WINGS, 2);
    await asUser(db, CUSTOMER, (tx) => tx.query(`update carts set promo_code = 'WELCOME10' where user_id = $1`, [CUSTOMER]));
    expect(await quote(CUSTOMER)).toMatchObject({ discount: 0, promo: { applied: false, message: expect.stringContaining('first order') } });
    await expect(place(CUSTOMER, address, '99999999-9999-4999-8999-999999999992')).rejects.toThrow(/first order/);
    await asUser(db, CUSTOMER, (tx) => tx.query(`update carts set promo_code = null where user_id = $1`, [CUSTOMER]));
  });

  it('rejects someone else’s address, unavailable items and below-minimum carts without leaving partial orders', async () => {
    await expect(place(CUSTOMER, otherAddress, '99999999-9999-4999-8999-999999999993')).rejects.toThrow(/delivery address/);
    await db.exec(`update food_items set is_available = false where id = '${WINGS}'`);
    expect(await quote(CUSTOMER)).toMatchObject({ has_issues: true });
    await expect(place(CUSTOMER, address, '99999999-9999-4999-8999-999999999994')).rejects.toThrow(/need attention/);
    await db.exec(`update food_items set is_available = true where id = '${WINGS}'`);
    await asUser(db, CUSTOMER, (tx) => tx.query('delete from cart_items where user_id = $1', [CUSTOMER]));
    await add(CUSTOMER, FRIES, 1);
    await expect(place(CUSTOMER, address, '99999999-9999-4999-8999-999999999995')).rejects.toThrow(/minimum order/);
    const n = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ n: number }>('select count(*)::int n from orders'))).n);
    expect(n).toBe(1);
  });

  it('never lets clients insert or edit orders directly', async () => {
    await expect(asUser(db, CUSTOMER, (tx) => tx.query(`update orders set status = 'delivered', total_amount = 0 where id = $1`, [orderId]))).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, CUSTOMER, (tx) => tx.query(`insert into orders (user_id, restaurant_name_snapshot, delivery_address_snapshot, customer_name_snapshot, customer_phone_snapshot, eta_min_minutes, eta_max_minutes, subtotal, delivery_fee, service_fee, total_amount, payment_method, payment_status, idempotency_key) values ($1, 'x', '{}', 'x', '1', 1, 1, 0, 0, 0, 0, 'demo_card', 'paid', gen_random_uuid())`, [CUSTOMER])),
    ).rejects.toThrow(/permission denied/);
  });

  it('hides orders from other customers and other restaurants', async () => {
    const other = await asUser(db, OTHER, async (tx) => (await tx.query('select id from orders')).rows.length);
    const owner2 = await asUser(db, OWNER2, async (tx) => (await tx.query('select id from orders')).rows.length);
    const owner = await asUser(db, OWNER, async (tx) => (await tx.query('select id from orders')).rows.length);
    expect({ other, owner2, owner }).toEqual({ other: 0, owner2: 0, owner: 1 });
  });

  describe('status changes', () => {
    it('lets only the owning restaurant move an order forward, through valid steps', async () => {
      await expect(setStatus(CUSTOMER, orderId, 'confirmed')).rejects.toThrow(/Only the restaurant/);
      await expect(setStatus(OWNER2, orderId, 'confirmed')).rejects.toThrow(/Order not found/);
      await expect(setStatus(OWNER, orderId, 'delivered')).rejects.toThrow(/Can’t change an order from pending to delivered/);
      await setStatus(OWNER, orderId, 'confirmed');
      await expect(setStatus(CUSTOMER, orderId, 'cancelled')).rejects.toThrow(/Only the restaurant/);
      for (const s of ['preparing', 'out_for_delivery', 'delivered']) await setStatus(OWNER, orderId, s);
      const o = await asUser(db, CUSTOMER, (tx) => one(tx.query<{ status: string; payment_status: string }>('select status, payment_status from orders where id = $1', [orderId])));
      expect(o).toEqual({ status: 'delivered', payment_status: 'demo_authorized' }); // demo card never becomes "paid"
      const hist = await asUser(db, CUSTOMER, async (tx) => (await tx.query<{ status: string }>('select status from order_status_history where order_id = $1 order by created_at, status', [orderId])).rows.length);
      expect(hist).toBe(5);
      const notes = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ n: number }>('select count(*)::int n from notifications'))).n);
      expect(notes).toBe(5);
    });

    it('lets a customer cancel only while pending, and voids/clears payment', async () => {
      await add(CUSTOMER, WINGS, 2);
      const cash = await place(CUSTOMER, address, '99999999-9999-4999-8999-999999999996', 'cash_on_delivery');
      await setStatus(CUSTOMER, cash, 'cancelled');
      const o = await asUser(db, CUSTOMER, (tx) => one(tx.query<{ status: string; payment_status: string; cancellation_reason: string }>('select status, payment_status, cancellation_reason from orders where id = $1', [cash])));
      expect(o).toEqual({ status: 'cancelled', payment_status: 'not_charged', cancellation_reason: 'Cancelled by you.' });
      await expect(setStatus(OWNER, cash, 'confirmed')).rejects.toThrow(/cancelled to confirmed/);
    });

    it('marks cash as paid on delivery', async () => {
      await add(CUSTOMER, WINGS, 2);
      const cash = await place(CUSTOMER, address, '99999999-9999-4999-8999-999999999997', 'cash_on_delivery');
      for (const s of ['confirmed', 'preparing', 'out_for_delivery']) await setStatus(OWNER, cash, s);
      const before = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ p: string }>('select payment_status p from orders where id = $1', [cash]))).p);
      await setStatus(OWNER, cash, 'delivered');
      const after = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ p: string }>('select payment_status p from orders where id = $1', [cash]))).p);
      expect([before, after]).toEqual(['due_on_delivery', 'paid']);
    });
  });

  describe('reviews', () => {
    it('allows one review per delivered order, by its customer only', async () => {
      await expect(asUser(db, OTHER, (tx) => tx.query('insert into reviews (order_id, user_id, restaurant_id, rating) values ($1, $2, $3, 5)', [orderId, OTHER, R1]))).rejects.toThrow(/row-level security/);
      await asUser(db, CUSTOMER, (tx) => tx.query('insert into reviews (order_id, user_id, restaurant_id, rating) values ($1, $2, $3, 4)', [orderId, CUSTOMER, R1]));
      await expect(asUser(db, CUSTOMER, (tx) => tx.query('insert into reviews (order_id, user_id, restaurant_id, rating) values ($1, $2, $3, 5)', [orderId, CUSTOMER, R1]))).rejects.toThrow(/duplicate key/);
      const r = await asUser(db, null, (tx) => one(tx.query<{ rating: string; review_count: number }>('select rating, review_count from restaurant_ratings where restaurant_id = $1', [R1])));
      expect(r).toEqual({ rating: '4.0', review_count: 1 });
    });
  });

  it('reorders a past order into a fresh cart', async () => {
    const res = await asUser(db, CUSTOMER, async (tx) => (await one(tx.query<{ r: { added: number; skipped: number } }>('select reorder($1) r', [orderId]))).r);
    expect(res).toEqual({ added: 3, skipped: 0 });
    expect(await quote(CUSTOMER)).toMatchObject({ subtotal: 42.5 });
  });
});

describe('roles', () => {
  it('cannot be self-assigned', async () => {
    await expect(asUser(db, CUSTOMER, (tx) => tx.query(`insert into user_roles values ($1, 'admin')`, [CUSTOMER]))).rejects.toThrow(/permission denied/);
  });
});
