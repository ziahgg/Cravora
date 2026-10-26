-- Cravora schema: catalog, customers, carts, orders, reviews, notifications + RLS.
-- Money is numeric(10,2) in USD (see README "Pricing"). Prices are never accepted from the client:
-- orders are created only by public.place_order(), which reads authoritative menu prices.

-- ───────────── Roles ─────────────
-- Privileged roles are granted only by SQL/migrations (no policy lets users write this table).
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('restaurant_owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;

-- ───────────── Profiles & addresses ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  order_updates boolean not null default true,
  promo_offers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'home' check (label in ('home', 'work', 'other')),
  recipient_name text not null check (char_length(recipient_name) between 1 and 60),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  address_line text not null check (char_length(address_line) between 3 and 120),
  unit text not null default '' check (char_length(unit) <= 40),
  city text not null check (char_length(city) between 2 and 60),
  postal_code text not null check (postal_code ~ '^[A-Za-z0-9 -]{3,10}$'),
  delivery_instructions text not null default '' check (char_length(delivery_instructions) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

-- ───────────── Catalog ─────────────
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  description text not null default '',
  cuisine text not null,
  tags text[] not null default '{}',
  price_level smallint not null default 2 check (price_level between 1 and 3),
  image_key text,
  address text not null default '',
  delivery_fee numeric(10,2) not null default 2.99 check (delivery_fee >= 0),
  free_delivery_until timestamptz,          -- restaurant-funded free delivery promotion
  min_order numeric(10,2) not null default 10 check (min_order >= 0),
  eta_min_minutes integer not null default 20 check (eta_min_minutes > 0),
  eta_max_minutes integer not null default 30 check (eta_max_minutes >= eta_min_minutes),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index restaurants_owner_idx on public.restaurants (owner_user_id);
create index restaurants_cuisine_idx on public.restaurants (cuisine) where is_active;

create table public.food_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (restaurant_id, slug)
);

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.food_categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  description text not null default '',
  short_description text not null default '',
  image_key text,
  price numeric(10,2) not null check (price > 0),
  is_available boolean not null default true,
  is_popular boolean not null default false,
  -- Approximate nutrition shown on dish details (optional).
  calories integer check (calories >= 0),
  protein_g integer check (protein_g >= 0),
  fat_g integer check (fat_g >= 0),
  carbs_g integer check (carbs_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);
create index food_items_restaurant_idx on public.food_items (restaurant_id, category_id);
create index food_items_name_idx on public.food_items (lower(name));

-- Customisation: an option group ("Choose bun") has values ("Brioche", "+ Smoked bacon").
create table public.food_item_options (
  id uuid primary key default gen_random_uuid(),
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  name text not null,
  selection_type text not null check (selection_type in ('single', 'multiple')),
  is_required boolean not null default false,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections >= 1),
  sort_order integer not null default 0,
  check (min_selections <= max_selections),
  check (not is_required or min_selections >= 1),
  check (selection_type = 'multiple' or max_selections = 1)
);
create index food_item_options_item_idx on public.food_item_options (food_item_id);

create table public.food_item_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.food_item_options (id) on delete cascade,
  name text not null,
  additional_price numeric(10,2) not null default 0 check (additional_price >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0
);
create index food_item_option_values_option_idx on public.food_item_option_values (option_id);

-- ───────────── Favorites ─────────────
create table public.favorite_restaurants (
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create table public.favorite_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_item_id)
);

-- ───────────── Cart (one per user, one restaurant per cart) ─────────────
create table public.carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  promo_code text check (promo_code is null or promo_code ~ '^[A-Z0-9]{3,20}$'),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.carts (user_id) on delete cascade,
  food_item_id uuid not null references public.food_items (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 20),
  options_key text not null default '',  -- sorted option value ids: identical configurations merge
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, food_item_id, options_key)
);

create table public.cart_item_options (
  cart_item_id uuid not null references public.cart_items (id) on delete cascade,
  option_value_id uuid not null references public.food_item_option_values (id) on delete cascade,
  primary key (cart_item_id, option_value_id)
);

-- ───────────── Promotions ─────────────
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  description text not null,
  percent_off numeric(5,2) not null check (percent_off > 0 and percent_off <= 100),
  max_discount numeric(10,2) check (max_discount > 0),
  min_subtotal numeric(10,2) not null default 0 check (min_subtotal >= 0),
  first_order_only boolean not null default false,
  per_user_limit integer not null default 1 check (per_user_limit >= 1),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true
);

-- ───────────── Orders ─────────────
create sequence public.order_number_seq start 30000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('CRV-' || nextval('public.order_number_seq')),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  restaurant_name_snapshot text not null,
  restaurant_image_key text,
  delivery_address_snapshot jsonb not null,
  customer_name_snapshot text not null,
  customer_phone_snapshot text not null,
  delivery_instructions text not null default '',
  scheduled_for timestamptz,
  eta_min_minutes integer not null,
  eta_max_minutes integer not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
  cancellation_reason text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null check (delivery_fee >= 0),
  service_fee numeric(10,2) not null check (service_fee >= 0),
  discount_amount numeric(10,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  promo_code text,
  -- No payment provider is connected: cash is collected on delivery; "demo_card" is a simulated
  -- card that never moves money. payment_status is changed only by update_order_status().
  payment_method text not null check (payment_method in ('cash_on_delivery', 'demo_card')),
  payment_status text not null
    check (payment_status in ('due_on_delivery', 'paid', 'demo_authorized', 'demo_voided', 'not_charged')),
  idempotency_key uuid not null,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (total_amount = subtotal + delivery_fee + service_fee - discount_amount),
  check ((status = 'cancelled') = (cancellation_reason is not null))
);
create index orders_user_idx on public.orders (user_id, placed_at desc);
create index orders_restaurant_idx on public.orders (restaurant_id, status, placed_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  food_item_id uuid references public.food_items (id) on delete set null,
  item_name_snapshot text not null,
  image_key_snapshot text,
  unit_price_snapshot numeric(10,2) not null check (unit_price_snapshot >= 0), -- base + options
  quantity integer not null check (quantity between 1 and 20),
  selected_options_snapshot jsonb not null default '[]',
  line_total numeric(10,2) not null check (line_total = unit_price_snapshot * quantity),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_food_idx on public.order_items (food_item_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status text not null,
  note text not null default '',
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.promotion_redemptions (
  promotion_id uuid not null references public.promotions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index promotion_redemptions_user_idx on public.promotion_redemptions (user_id, promotion_id);

-- ───────────── Reviews (ratings are computed from these) ─────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index reviews_restaurant_idx on public.reviews (restaurant_id);

create view public.restaurant_ratings with (security_invoker = true) as
  select restaurant_id, round(avg(rating)::numeric, 1) as rating, count(*)::int as review_count
  from public.reviews group by restaurant_id;

-- ───────────── Notifications ─────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('order', 'promo', 'review')),
  title text not null,
  body text not null default '',
  link text check (link is null or link like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────── Housekeeping triggers ─────────────
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_addresses before update on public.addresses for each row execute function public.touch_updated_at();
create trigger t_restaurants before update on public.restaurants for each row execute function public.touch_updated_at();
create trigger t_food_items before update on public.food_items for each row execute function public.touch_updated_at();
create trigger t_cart_items before update on public.cart_items for each row execute function public.touch_updated_at();
create trigger t_orders before update on public.orders for each row execute function public.touch_updated_at();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (new.id, coalesce(left(new.raw_user_meta_data ->> 'display_name', 60), ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Owners of a restaurant (or admins) — used by policies and functions.
create function public.can_manage_restaurant(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.restaurants r
    join public.user_roles ur on ur.user_id = r.owner_user_id and ur.role = 'restaurant_owner'
    where r.id = p_restaurant and r.owner_user_id = auth.uid()
  )
$$;

-- ───────────── Row Level Security ─────────────
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.restaurants enable row level security;
alter table public.food_categories enable row level security;
alter table public.food_items enable row level security;
alter table public.food_item_options enable row level security;
alter table public.food_item_option_values enable row level security;
alter table public.favorite_restaurants enable row level security;
alter table public.favorite_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.cart_item_options enable row level security;
alter table public.promotions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

create policy roles_self_read on public.user_roles for select to authenticated using (user_id = (select auth.uid()));

create policy profiles_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Public catalog: anyone may read active restaurants and their available menus.
-- Managers (owner/admin) also see inactive rows and may edit their own catalog.
create policy restaurants_read on public.restaurants for select to anon, authenticated
  using (is_active or public.can_manage_restaurant(id));
create policy restaurants_manage on public.restaurants for update to authenticated
  using (public.can_manage_restaurant(id)) with check (public.can_manage_restaurant(id));

create policy categories_read on public.food_categories for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active) or public.can_manage_restaurant(restaurant_id));
create policy categories_manage on public.food_categories for all to authenticated
  using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

create policy items_read on public.food_items for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active) or public.can_manage_restaurant(restaurant_id));
create policy items_manage on public.food_items for all to authenticated
  using (public.can_manage_restaurant(restaurant_id)) with check (public.can_manage_restaurant(restaurant_id));

create policy options_read on public.food_item_options for select to anon, authenticated using (true);
create policy options_manage on public.food_item_options for all to authenticated
  using (exists (select 1 from public.food_items f where f.id = food_item_id and public.can_manage_restaurant(f.restaurant_id)))
  with check (exists (select 1 from public.food_items f where f.id = food_item_id and public.can_manage_restaurant(f.restaurant_id)));
create policy option_values_read on public.food_item_option_values for select to anon, authenticated using (true);
create policy option_values_manage on public.food_item_option_values for all to authenticated
  using (exists (select 1 from public.food_item_options o join public.food_items f on f.id = o.food_item_id where o.id = option_id and public.can_manage_restaurant(f.restaurant_id)))
  with check (exists (select 1 from public.food_item_options o join public.food_items f on f.id = o.food_item_id where o.id = option_id and public.can_manage_restaurant(f.restaurant_id)));

create policy fav_restaurants_own on public.favorite_restaurants for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy fav_items_own on public.favorite_items for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Carts: readable/clearable by their owner. Adding items goes through cart_add() (validates options).
create policy carts_own on public.carts for select to authenticated using (user_id = (select auth.uid()));
create policy carts_update on public.carts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cart_items_read on public.cart_items for select to authenticated using (user_id = (select auth.uid()));
create policy cart_items_update on public.cart_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cart_items_delete on public.cart_items for delete to authenticated using (user_id = (select auth.uid()));
create policy cart_item_options_read on public.cart_item_options for select to authenticated
  using (exists (select 1 from public.cart_items ci where ci.id = cart_item_id and ci.user_id = (select auth.uid())));

-- Promotions are validated inside quote_cart()/place_order(); codes are not listable by clients.
create policy promotions_admin on public.promotions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Orders: customers read their own; restaurant managers read their restaurant's. No direct writes —
-- creation and status changes happen only in place_order() / update_order_status().
create policy orders_read on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_restaurant(restaurant_id));
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or public.can_manage_restaurant(o.restaurant_id))));
create policy order_history_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = (select auth.uid()) or public.can_manage_restaurant(o.restaurant_id))));
create policy redemptions_own on public.promotion_redemptions for select to authenticated using (user_id = (select auth.uid()));

-- Reviews: public to read; a customer may review their own delivered order once.
create policy reviews_read on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert on public.reviews for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())
              and o.status = 'delivered' and o.restaurant_id = reviews.restaurant_id)
);

create policy notifications_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- Privilege guards (RLS limits rows; these limit operations and columns).
-- Order data is written only by SECURITY DEFINER functions.
revoke insert, update, delete on public.orders, public.order_items, public.order_status_history, public.promotion_redemptions from anon, authenticated;
-- Cart rows are created by cart_add(); customers may only change a line's quantity or the cart's promo code.
revoke insert, update on public.carts, public.cart_items, public.cart_item_options from authenticated;
grant update (quantity) on public.cart_items to authenticated;
grant update (promo_code) on public.carts to authenticated;
-- Notifications: only mark as read.
revoke insert, update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
-- Profiles: users edit their own details, never the id.
revoke insert, update on public.profiles from authenticated;
grant update (display_name, phone, order_updates, promo_offers) on public.profiles to authenticated;
-- Reviews: insert only (no edits); restaurants: managers can't change ownership.
revoke update, delete on public.reviews from authenticated;
revoke update on public.restaurants from authenticated;
grant update (name, description, image_key, address, delivery_fee, free_delivery_until, min_order, eta_min_minutes, eta_max_minutes, is_active) on public.restaurants to authenticated;
revoke all on public.user_roles from anon;
revoke insert, update, delete on public.user_roles from authenticated;
revoke all on public.addresses, public.carts, public.cart_items, public.cart_item_options, public.notifications,
  public.favorite_restaurants, public.favorite_items, public.profiles, public.promotions from anon;
