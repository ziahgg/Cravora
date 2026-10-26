-- Ordering logic. Pricing lives here so the quote shown in the cart and the amount stored on the
-- order come from the same code path:
--   unit price   = item price + Σ selected option value prices
--   line total   = unit price × quantity
--   subtotal     = Σ line totals
--   delivery fee = restaurant.delivery_fee (0 while restaurant.free_delivery_until is in the future)
--   service fee  = round(subtotal × 4%, 2)
--   discount     = min(round(subtotal × promo %, 2), promo.max_discount)   (promo validated server-side)
--   total        = subtotal + delivery fee + service fee − discount
-- Functions that write are SECURITY DEFINER and check auth.uid() themselves; all others run as the caller.

create function public.service_fee_rate() returns numeric language sql immutable as $$ select 0.04::numeric $$;

-- Returns null when the selection is valid for the item, otherwise a user-facing message.
create function public._option_error(p_item uuid, p_values uuid[]) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  o record;
  n int;
begin
  p_values := coalesce(p_values, '{}');
  if cardinality(p_values) <> (select count(distinct v) from unnest(p_values) v) then
    return 'An option was selected twice.';
  end if;
  if exists (
    select 1 from unnest(p_values) v
    where not exists (select 1 from public.food_item_option_values ov join public.food_item_options op on op.id = ov.option_id
                      where ov.id = v and op.food_item_id = p_item)
  ) then
    return 'One of the selected options isn’t offered for this dish anymore.';
  end if;
  if exists (select 1 from public.food_item_option_values ov where ov.id = any (p_values) and not ov.is_available) then
    return 'One of the selected options is sold out.';
  end if;
  for o in select * from public.food_item_options where food_item_id = p_item loop
    select count(*) into n from public.food_item_option_values where option_id = o.id and id = any (p_values);
    if n < o.min_selections then
      return format('Choose %s in “%s”.', case when o.min_selections = 1 then 'an option' else o.min_selections || ' options' end, o.name);
    end if;
    if n > o.max_selections then
      return format('Choose at most %s in “%s”.', o.max_selections, o.name);
    end if;
  end loop;
  return null;
end $$;

-- Adds a configured dish to the caller's cart. One restaurant per cart: when the cart holds another
-- restaurant's food, returns {"status":"conflict"} unless p_replace is true (then the cart is cleared first).
create function public.cart_add(p_item uuid, p_quantity int, p_option_values uuid[] default '{}', p_replace boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  item record;
  cart_restaurant uuid;
  err text;
  k text;
  line_id uuid;
  existing_count int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    return jsonb_build_object('status', 'invalid', 'message', 'Quantity must be between 1 and 20.');
  end if;
  select f.*, r.is_active as restaurant_active, r.name as restaurant_name into item
  from public.food_items f join public.restaurants r on r.id = f.restaurant_id where f.id = p_item;
  if not found or not item.restaurant_active then
    return jsonb_build_object('status', 'invalid', 'message', 'This dish isn’t available.');
  end if;
  if not item.is_available then
    return jsonb_build_object('status', 'invalid', 'message', 'This dish is sold out right now.');
  end if;
  err := public._option_error(p_item, p_option_values);
  if err is not null then return jsonb_build_object('status', 'invalid', 'message', err); end if;

  insert into public.carts (user_id) values (uid) on conflict (user_id) do nothing;
  select restaurant_id into cart_restaurant from public.carts where user_id = uid for update;
  select count(*) into existing_count from public.cart_items where user_id = uid;
  if existing_count > 0 and cart_restaurant is distinct from item.restaurant_id then
    if not p_replace then
      return jsonb_build_object('status', 'conflict', 'current_restaurant', (select name from public.restaurants where id = cart_restaurant));
    end if;
    delete from public.cart_items where user_id = uid;
    update public.carts set promo_code = null where user_id = uid;
  end if;
  update public.carts set restaurant_id = item.restaurant_id, updated_at = now() where user_id = uid;

  k := coalesce((select string_agg(v::text, ',' order by v) from unnest(coalesce(p_option_values, '{}')) v), '');
  insert into public.cart_items (user_id, food_item_id, quantity, options_key)
  values (uid, p_item, p_quantity, k)
  on conflict (user_id, food_item_id, options_key)
    do update set quantity = least(20, public.cart_items.quantity + excluded.quantity)
  returning id into line_id;
  insert into public.cart_item_options (cart_item_id, option_value_id)
  select line_id, v from unnest(coalesce(p_option_values, '{}')) v on conflict do nothing;

  return jsonb_build_object('status', 'added', 'cart_item_id', line_id,
    'count', (select coalesce(sum(quantity), 0) from public.cart_items where user_id = uid));
end $$;

-- Cart lines for a user with live prices and availability problems (internal).
create function public._cart_lines(p_user uuid)
returns table (cart_item_id uuid, food_item_id uuid, name text, image_key text, quantity int, option_ids uuid[],
               options jsonb, unit_price numeric, line_total numeric, issue text)
language sql stable security definer set search_path = '' as $$
  select ci.id, f.id, f.name, f.image_key, ci.quantity,
         coalesce(array_agg(ov.id order by op.sort_order, ov.sort_order) filter (where ov.id is not null), '{}'),
         coalesce(jsonb_agg(jsonb_build_object('option', op.name, 'value', ov.name, 'value_id', ov.id, 'price', ov.additional_price)
                            order by op.sort_order, ov.sort_order) filter (where ov.id is not null), '[]'),
         f.price + coalesce(sum(ov.additional_price), 0),
         (f.price + coalesce(sum(ov.additional_price), 0)) * ci.quantity,
         case
           when not r.is_active then 'This restaurant isn’t taking orders.'
           when not f.is_available then 'Sold out right now.'
           when f.restaurant_id is distinct from c.restaurant_id then 'Belongs to another restaurant.'
           else public._option_error(f.id, coalesce(array_agg(ov.id) filter (where ov.id is not null), '{}'))
         end
  from public.cart_items ci
  join public.carts c on c.user_id = ci.user_id
  join public.food_items f on f.id = ci.food_item_id
  join public.restaurants r on r.id = f.restaurant_id
  left join public.cart_item_options cio on cio.cart_item_id = ci.id
  left join public.food_item_option_values ov on ov.id = cio.option_value_id
  left join public.food_item_options op on op.id = ov.option_id
  where ci.user_id = p_user
  group by ci.id, f.id, r.is_active, c.restaurant_id
  order by ci.created_at
$$;

-- Validates a promo code for a user and subtotal. Returns (promotion id, discount, message).
create function public._promo_check(p_user uuid, p_code text, p_subtotal numeric)
returns table (promotion_id uuid, discount numeric, message text)
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.promotions;
  used int;
begin
  if p_code is null then return; end if;
  select * into p from public.promotions where code = upper(p_code);
  if not found or not p.is_active or p.starts_at > now() or (p.ends_at is not null and p.ends_at <= now()) then
    return query select null::uuid, 0::numeric, 'This code isn’t valid right now.'; return;
  end if;
  if p_subtotal < p.min_subtotal then
    return query select null::uuid, 0::numeric, format('Add $%s more to use %s.', to_char(p.min_subtotal - p_subtotal, 'FM9990.00'), p.code); return;
  end if;
  if p.first_order_only and exists (select 1 from public.orders where user_id = p_user and status <> 'cancelled') then
    return query select null::uuid, 0::numeric, p.code || ' is for your first order only.'; return;
  end if;
  select count(*) into used from public.promotion_redemptions r join public.orders o on o.id = r.order_id
    where r.user_id = p_user and r.promotion_id = p.id and o.status <> 'cancelled';
  if used >= p.per_user_limit then
    return query select null::uuid, 0::numeric, 'You’ve already used ' || p.code || '.'; return;
  end if;
  return query select p.id, least(round(p_subtotal * p.percent_off / 100, 2), coalesce(p.max_discount, 'infinity'::numeric)), p.description;
end $$;

-- The caller's cart with a full price breakdown. Used by the cart and checkout screens.
create function public.quote_cart() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  c public.carts;
  r public.restaurants;
  lines jsonb;
  sub numeric := 0;
  fee numeric := 0;
  svc numeric := 0;
  pr record;
  disc numeric := 0;
  has_issue boolean;
  free boolean := false;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into c from public.carts where user_id = uid;
  select coalesce(jsonb_agg(to_jsonb(l)), '[]'), coalesce(sum(l.line_total) filter (where l.issue is null), 0), bool_or(l.issue is not null)
    into lines, sub, has_issue from public._cart_lines(uid) l;
  if jsonb_array_length(lines) = 0 then
    return jsonb_build_object('items', '[]'::jsonb, 'count', 0);
  end if;
  select * into r from public.restaurants where id = c.restaurant_id;
  free := r.free_delivery_until is not null and r.free_delivery_until > now();
  fee := case when free then 0 else r.delivery_fee end;
  svc := round(sub * public.service_fee_rate(), 2);
  select * into pr from public._promo_check(uid, c.promo_code, sub);
  disc := coalesce(pr.discount, 0);
  return jsonb_build_object(
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'image_key', r.image_key,
                                     'eta_min', r.eta_min_minutes, 'eta_max', r.eta_max_minutes, 'min_order', r.min_order),
    'items', lines,
    'count', (select sum(quantity) from public.cart_items where user_id = uid),
    'subtotal', sub, 'delivery_fee', fee, 'free_delivery', free, 'service_fee', svc,
    'promo', case when c.promo_code is null then null else jsonb_build_object('code', c.promo_code, 'applied', pr.promotion_id is not null, 'message', pr.message, 'discount', disc) end,
    'discount', disc,
    'total', sub + fee + svc - disc,
    'has_issues', has_issue,
    'below_minimum', sub < r.min_order
  );
end $$;

-- Places an order from the caller's cart in ONE transaction: validates everything, snapshots names,
-- prices, options and the address, records the promo redemption and clears the cart.
-- Idempotent: the same p_idempotency_key returns the order created the first time.
create function public.place_order(
  p_address_id uuid, p_payment_method text, p_idempotency_key uuid,
  p_scheduled_for timestamptz default null, p_instructions text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  existing uuid;
  c public.carts;
  r public.restaurants;
  a public.addresses;
  prof public.profiles;
  sub numeric;
  fee numeric;
  svc numeric;
  pr record;
  disc numeric := 0;
  bad text;
  v_order uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'missing idempotency key' using errcode = '22023'; end if;

  select id into existing from public.orders where user_id = uid and idempotency_key = p_idempotency_key;
  if existing is not null then return existing; end if;

  if p_payment_method not in ('cash_on_delivery', 'demo_card') then
    raise exception 'Choose a payment method.' using errcode = '22023';
  end if;
  if p_scheduled_for is not null and (p_scheduled_for < now() + interval '30 minutes' or p_scheduled_for > now() + interval '7 days') then
    raise exception 'Scheduled time must be between 30 minutes and 7 days from now.' using errcode = '22023';
  end if;

  select * into c from public.carts where user_id = uid for update;  -- serialises concurrent checkouts
  if not found or not exists (select 1 from public.cart_items where user_id = uid) then
    raise exception 'Your cart is empty.' using errcode = '22023';
  end if;
  select * into r from public.restaurants where id = c.restaurant_id;
  if not found or not r.is_active then raise exception 'This restaurant isn’t taking orders.' using errcode = '22023'; end if;

  select issue into bad from public._cart_lines(uid) where issue is not null limit 1;
  if bad is not null then raise exception 'Some items need attention: %', bad using errcode = '22023'; end if;

  select * into a from public.addresses where id = p_address_id and user_id = uid;
  if not found then raise exception 'Choose a delivery address.' using errcode = '22023'; end if;
  select * into prof from public.profiles where id = uid;

  select sum(line_total) into sub from public._cart_lines(uid);
  if sub < r.min_order then
    raise exception 'The minimum order here is $%.', to_char(r.min_order, 'FM9990.00') using errcode = '22023';
  end if;
  fee := case when r.free_delivery_until is not null and r.free_delivery_until > now() then 0 else r.delivery_fee end;
  svc := round(sub * public.service_fee_rate(), 2);
  if c.promo_code is not null then
    select * into pr from public._promo_check(uid, c.promo_code, sub);
    if pr.promotion_id is null then raise exception '%', pr.message using errcode = '22023'; end if;
    disc := pr.discount;
  end if;

  insert into public.orders (user_id, restaurant_id, restaurant_name_snapshot, restaurant_image_key, delivery_address_snapshot,
    customer_name_snapshot, customer_phone_snapshot, delivery_instructions, scheduled_for, eta_min_minutes, eta_max_minutes,
    subtotal, delivery_fee, service_fee, discount_amount, total_amount, promo_code, payment_method, payment_status, idempotency_key)
  values (uid, r.id, r.name, r.image_key,
    jsonb_build_object('label', a.label, 'address_line', a.address_line, 'unit', a.unit, 'city', a.city, 'postal_code', a.postal_code),
    a.recipient_name, a.phone, left(coalesce(nullif(trim(p_instructions), ''), a.delivery_instructions), 200), p_scheduled_for,
    r.eta_min_minutes, r.eta_max_minutes, sub, fee, svc, disc, sub + fee + svc - disc,
    case when disc > 0 then c.promo_code end, p_payment_method,
    case when p_payment_method = 'cash_on_delivery' then 'due_on_delivery' else 'demo_authorized' end, p_idempotency_key)
  returning id into v_order;

  insert into public.order_items (order_id, food_item_id, item_name_snapshot, image_key_snapshot, unit_price_snapshot, quantity, selected_options_snapshot, line_total)
  select v_order, l.food_item_id, l.name, l.image_key, l.unit_price, l.quantity, l.options, l.line_total from public._cart_lines(uid) l;

  if disc > 0 then
    insert into public.promotion_redemptions (promotion_id, user_id, order_id) values (pr.promotion_id, uid, v_order);
  end if;
  insert into public.order_status_history (order_id, status, note, changed_by)
  values (v_order, 'pending', 'Order placed', uid);

  delete from public.cart_items where user_id = uid;
  update public.carts set restaurant_id = null, promo_code = null, updated_at = now() where user_id = uid;
  return v_order;
exception when unique_violation then
  -- A concurrent request with the same key won the race: return its order.
  select id into existing from public.orders where user_id = uid and idempotency_key = p_idempotency_key;
  if existing is not null then return existing; end if;
  raise;
end $$;

-- Order state machine. Customers may cancel their own order while it is still pending; restaurant
-- owners (for their restaurants) and admins move orders forward or cancel before dispatch.
create function public.order_transition_allowed(p_from text, p_to text) returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('pending', 'confirmed'), ('pending', 'cancelled'),
    ('confirmed', 'preparing'), ('confirmed', 'cancelled'),
    ('preparing', 'out_for_delivery'),
    ('out_for_delivery', 'delivered')
  )
$$;

create function public.update_order_status(p_order_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o public.orders;
  manager boolean;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  manager := public.can_manage_restaurant(o.restaurant_id);
  if not manager and o.user_id <> uid then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  if not public.order_transition_allowed(o.status, p_status) then
    raise exception 'Can’t change an order from % to %.', o.status, p_status using errcode = '22023';
  end if;
  if not manager and not (p_status = 'cancelled' and o.status = 'pending') then
    raise exception 'Only the restaurant can update this order.' using errcode = '42501';
  end if;

  update public.orders set
    status = p_status,
    cancellation_reason = case when p_status = 'cancelled'
      then coalesce(nullif(trim(p_note), ''), case when manager and o.user_id <> uid then 'The restaurant couldn’t accept this order.' else 'Cancelled by you.' end) end,
    payment_status = case
      when p_status = 'cancelled' and o.payment_method = 'demo_card' then 'demo_voided'
      when p_status = 'cancelled' then 'not_charged'
      when p_status = 'delivered' and o.payment_method = 'cash_on_delivery' then 'paid'
      else o.payment_status end
  where id = o.id;
  insert into public.order_status_history (order_id, status, note, changed_by)
  values (o.id, p_status, coalesce(left(p_note, 200), ''), uid);
end $$;

-- Reorder: replaces the cart with the items of a past order that can still be ordered as configured.
create function public.reorder(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  o public.orders;
  it record;
  res jsonb;
  added int := 0;
  skipped int := 0;
  first boolean := true;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order_id and user_id = uid;
  if not found then raise exception 'Order not found.' using errcode = 'P0002'; end if;
  for it in select * from public.order_items where order_id = o.id loop
    if it.food_item_id is null then skipped := skipped + 1; continue; end if;
    res := public.cart_add(it.food_item_id, it.quantity,
      coalesce((select array_agg((e ->> 'value_id')::uuid) from jsonb_array_elements(it.selected_options_snapshot) e), '{}'), first);
    if res ->> 'status' = 'added' then added := added + 1; first := false; else skipped := skipped + 1; end if;
  end loop;
  return jsonb_build_object('added', added, 'skipped', skipped);
end $$;

create function public.set_default_address(p_address_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.addresses set is_default = false where user_id = auth.uid() and is_default and id <> p_address_id;
  update public.addresses set is_default = true where id = p_address_id and user_id = auth.uid();
  if not found then raise exception 'Address not found.' using errcode = 'P0002'; end if;
end $$;

-- In-app notification for each status change (respects the customer's "Order updates" setting).
create function public.notify_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  wants boolean;
  t text;
  b text;
begin
  select * into o from public.orders where id = new.order_id;
  select order_updates into wants from public.profiles where id = o.user_id;
  if not coalesce(wants, true) then return new; end if;
  t := case new.status
    when 'pending' then 'Order placed'
    when 'confirmed' then 'Order confirmed'
    when 'preparing' then 'Your food is being prepared'
    when 'out_for_delivery' then 'Your order is on the way'
    when 'delivered' then 'Order delivered'
    when 'cancelled' then 'Order cancelled' end;
  b := case new.status
    when 'pending' then o.order_number || ' · waiting for ' || o.restaurant_name_snapshot || ' to confirm'
    when 'confirmed' then o.restaurant_name_snapshot || ' accepted your order'
    when 'preparing' then o.order_number || ' · the kitchen is on it'
    when 'out_for_delivery' then o.order_number || ' · heading to you'
    when 'delivered' then 'Enjoy! Rate your ' || o.restaurant_name_snapshot || ' order'
    when 'cancelled' then o.order_number || ' · ' || coalesce(o.cancellation_reason, '') end;
  insert into public.notifications (user_id, kind, title, body, link) values (o.user_id, 'order', t, b, '/orders/' || o.id);
  return new;
end $$;
create trigger on_order_status after insert on public.order_status_history for each row execute function public.notify_order_status();

revoke execute on function public._option_error(uuid, uuid[]), public._cart_lines(uuid), public._promo_check(uuid, text, numeric),
  public.notify_order_status(), public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.cart_add(uuid, int, uuid[], boolean), public.quote_cart(), public.place_order(uuid, text, uuid, timestamptz, text),
  public.update_order_status(uuid, text, text), public.reorder(uuid), public.set_default_address(uuid) from public, anon;
grant execute on function public.cart_add(uuid, int, uuid[], boolean), public.quote_cart(), public.place_order(uuid, text, uuid, timestamptz, text),
  public.update_order_status(uuid, text, text), public.reorder(uuid), public.set_default_address(uuid) to authenticated;
