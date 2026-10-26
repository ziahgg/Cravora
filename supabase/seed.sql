-- DEVELOPMENT SEED ONLY (applied by `supabase db reset` locally — never run in production).
-- Restaurants, menus and prices are sample content for the Cravora demo; photos come from the
-- Figma file (Unsplash). Accounts (local only):
--   customer  demo@cravora.test   / cravora-demo
--   owner     owner@cravora.test  / cravora-owner   (manages Stack & Smoke Burgers)
--   owner     owner2@cravora.test / cravora-owner   (manages Kintsugi Ramen)
-- Ratings are real averages of the reviews below (written by seeded reviewer accounts).

create function pg_temp.sid(kind text, slug text) returns uuid language sql immutable as $$ select md5(kind || ':' || slug)::uuid $$;

create function pg_temp.mkuser(p_id uuid, p_email text, p_password text, p_name text, p_phone text) returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', p_name, 'phone', p_phone), now() - interval '6 months', now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true), 'email', now(), now(), now());
$$;

select pg_temp.mkuser('c0000000-0000-4000-8000-000000000001', 'demo@cravora.test', 'cravora-demo', 'Ziah Makmur', '+1 (512) 555-0148');
select pg_temp.mkuser('c0000000-0000-4000-8000-000000000002', 'owner@cravora.test', 'cravora-owner', 'Sam Ortega', '+1 (512) 555-0190');
select pg_temp.mkuser('c0000000-0000-4000-8000-000000000003', 'owner2@cravora.test', 'cravora-owner', 'Yuki Tanaka', '+1 (512) 555-0191');
select pg_temp.mkuser(('c0000000-0000-4000-8000-0000000001' || lpad(g::text, 2, '0'))::uuid, 'reviewer' || g || '@cravora.test', 'not-a-login-' || g, 'Reviewer ' || g, '+1 (512) 555-01' || lpad(g::text, 2, '0'))
from generate_series(1, 6) g;

insert into public.user_roles (user_id, role) values
  ('c0000000-0000-4000-8000-000000000002', 'restaurant_owner'),
  ('c0000000-0000-4000-8000-000000000003', 'restaurant_owner');

insert into public.restaurants (id, owner_user_id, name, slug, description, cuisine, tags, price_level, image_key, address, delivery_fee, free_delivery_until, min_order, eta_min_minutes, eta_max_minutes) values
  (pg_temp.sid('r','stack-smoke'), 'c0000000-0000-4000-8000-000000000002', 'Stack & Smoke Burgers', 'stack-smoke', 'Smash burgers, crispy chicken and loaded sides.', 'American', '{burger}', 2, 'stack-smoke', '512 E 6th St, Austin', 2.99, null, 10, 20, 30),
  (pg_temp.sid('r','patty-theory'), null, 'Patty Theory', 'patty-theory', 'No-nonsense classic burgers.', 'American', '{burger}', 1, 'classic-burger', '1801 E Cesar Chavez, Austin', 1.49, null, 8, 15, 25),
  (pg_temp.sid('r','cluck-bun'), null, 'Cluck & Bun', 'cluck-bun', 'Buttermilk fried chicken sandwiches and tenders.', 'American', '{burger,chicken}', 1, 'chicken-sandwich', '2001 S Congress Ave, Austin', 1.99, null, 8, 20, 30),
  (pg_temp.sid('r','kintsugi'), 'c0000000-0000-4000-8000-000000000003', 'Kintsugi Ramen', 'kintsugi-ramen', 'Slow-simmered broths and hand-pulled noodles.', 'Japanese', '{ramen}', 2, 'tonkotsu', '1100 S Lamar Blvd, Austin', 1.99, null, 12, 25, 35),
  (pg_temp.sid('r','forno-napoli'), null, 'Forno Napoli', 'forno-napoli', 'Wood-fired Neapolitan pizza and pasta.', 'Italian', '{pizza}', 2, 'margherita', '410 W 2nd St, Austin', 3.49, null, 15, 25, 40),
  (pg_temp.sid('r','taqueria-lupe'), null, 'Taquería Lupe', 'taqueria-lupe', 'Street tacos on fresh corn tortillas.', 'Mexican', '{tacos}', 1, 'tacos', '1500 E 7th St, Austin', 2.49, null, 8, 15, 25),
  (pg_temp.sid('r','green-bowl'), null, 'Green Bowl Co.', 'green-bowl', 'Grain bowls and salads built to order.', 'Healthy', '{bowls}', 2, 'green-bowl', '900 W 5th St, Austin', 2.99, now() + interval '7 days', 10, 20, 30),
  (pg_temp.sid('r','glaze-lab'), null, 'Glaze Lab Donuts', 'glaze-lab', 'Small-batch donuts and cold brew.', 'Desserts', '{desserts}', 1, 'donut', '2300 Manor Rd, Austin', 1.99, null, 8, 15, 25);

-- (restaurant, slug, name, sort)
insert into public.food_categories (id, restaurant_id, name, slug, sort_order)
select pg_temp.sid('c', r || ':' || s), pg_temp.sid('r', r), n, s, o from (values
  ('stack-smoke','burgers','Burgers',1), ('stack-smoke','sides','Sides',2), ('stack-smoke','drinks','Drinks',3),
  ('patty-theory','burgers','Burgers',1), ('patty-theory','sides','Sides & shakes',2),
  ('cluck-bun','sandwiches','Sandwiches',1), ('cluck-bun','sides','Sides',2),
  ('kintsugi','ramen','Ramen',1), ('kintsugi','small-plates','Small plates',2),
  ('forno-napoli','pizza','Pizza',1), ('forno-napoli','pasta','Pasta',2), ('forno-napoli','dessert','Dessert',3),
  ('taqueria-lupe','tacos','Tacos',1), ('taqueria-lupe','sides','Sides',2),
  ('green-bowl','bowls','Bowls',1), ('green-bowl','drinks','Drinks',2),
  ('glaze-lab','donuts','Donuts',1), ('glaze-lab','coffee','Coffee',2)
) v(r, s, n, o);

-- (restaurant, category, slug, name, short, description, price, image, popular, kcal, protein, fat, carbs)
insert into public.food_items (id, restaurant_id, category_id, slug, name, short_description, description, price, image_key, is_popular, calories, protein_g, fat_g, carbs_g)
select pg_temp.sid('f', r || ':' || s), pg_temp.sid('r', r), pg_temp.sid('c', r || ':' || c), s, n, sd, d, p, img, pop, kc, pr, ft, cb from (values
  ('stack-smoke','burgers','double-smash','Double Smash Cheeseburger','Two patties · house sauce','Two smashed beef patties with American cheese, pickles, grilled onions and our smoky house sauce on a toasted bun. Nutrition values are approximate.',12.50,'double-smash',true,820,48,52,38),
  ('stack-smoke','burgers','smoky-bbq','Smoky BBQ Burger','Brisket-smoked patty · BBQ','Smoked beef patty, cheddar, crispy onions and bourbon BBQ sauce.',13.50,'stack-smoke',false,910,46,55,52),
  ('stack-smoke','burgers','crispy-chicken','Crispy Chicken Sandwich','Buttermilk fried · slaw','Buttermilk fried chicken thigh, pickle slaw and comeback sauce.',11.00,'chicken-sandwich',true,760,38,40,62),
  ('stack-smoke','sides','truffle-fries','Truffle Parmesan Fries','Skin-on · parmesan','Skin-on fries, truffle oil, parmesan, chives.',5.50,'truffle-fries',false,480,8,26,54),
  ('stack-smoke','sides','hot-wings','Hot Wings (6 pcs)','Six wings · choose a sauce','Crispy wings tossed in your choice of sauce, with a dip.',9.00,'hot-wings',false,640,42,44,12),
  ('stack-smoke','drinks','cola','Cola','330 ml can','Ice-cold cola.',2.50,null,false,140,0,0,35),
  ('stack-smoke','drinks','lemonade','House Lemonade','Fresh-squeezed','Lemon, cane sugar, mint.',3.00,null,false,120,0,0,30),
  ('patty-theory','burgers','classic-beef','Classic Beef Burger','Single patty · cheddar','Quarter-pound patty, cheddar, lettuce, tomato, house mayo.',10.00,'classic-burger',true,690,36,38,44),
  ('patty-theory','sides','cheese-fries','Cheese Fries','Cheddar sauce','Crinkle-cut fries with cheddar sauce.',4.50,'truffle-fries',false,520,12,28,56),
  ('patty-theory','sides','vanilla-shake','Vanilla Shake','16 oz','Vanilla bean soft serve shake.',5.00,null,false,560,12,24,76),
  ('cluck-bun','sandwiches','cluck-classic','Crispy Chicken Sandwich','Buttermilk fried · pickles','Buttermilk fried chicken, pickles, spicy mayo, potato bun.',11.00,'chicken-sandwich',true,740,36,38,60),
  ('cluck-bun','sandwiches','tenders','Chicken Tenders (4 pcs)','With honey mustard','Hand-breaded tenders with honey mustard.',8.50,'chicken-tenders',false,610,40,30,40),
  ('cluck-bun','sides','fries','Seasoned Fries','Cajun seasoning','Fries with cajun seasoning.',3.50,null,false,420,5,20,52),
  ('kintsugi','ramen','tonkotsu','Tonkotsu Ramen','Pork broth · chashu','18-hour pork bone broth, chashu, ajitama egg, scallion.',15.00,'tonkotsu',true,880,42,38,86),
  ('kintsugi','ramen','spicy-shrimp','Spicy Shrimp Ramen','Chili miso · shrimp','Chili miso broth, tiger shrimp, corn, bok choy.',15.50,'shrimp-ramen',true,720,34,24,84),
  ('kintsugi','small-plates','gyoza','Pork Gyoza (6)','Pan-fried','Crispy-bottom pork dumplings with ponzu.',6.50,null,false,380,16,16,40),
  ('forno-napoli','pizza','margherita','Margherita Pizza','San Marzano · basil','San Marzano tomato, fior di latte, basil, olive oil.',16.00,'margherita',true,980,40,34,128),
  ('forno-napoli','pasta','arrabbiata','Penne all’Arrabbiata','Spicy tomato sauce','Penne in a garlicky chili tomato sauce.',13.50,null,false,720,22,18,116),
  ('forno-napoli','dessert','tiramisu','Tiramisu','Mascarpone · espresso','Classic tiramisu.',7.00,null,false,450,8,28,40),
  ('taqueria-lupe','tacos','street-tacos','Street Tacos (3)','Corn tortillas · salsa verde','Three tacos with onion, cilantro and salsa verde.',10.50,'tacos',true,560,32,22,54),
  ('taqueria-lupe','sides','chips-guac','Chips & Guacamole','Made to order','Tortilla chips with fresh guacamole.',6.00,null,false,520,6,32,52),
  ('green-bowl','bowls','avocado-power','Avocado Power Bowl','Quinoa · avocado · greens','Quinoa, avocado, kale, chickpeas, pickled onion, tahini.',13.00,'green-bowl',true,640,20,30,70),
  ('green-bowl','bowls','teriyaki-salmon','Teriyaki Salmon Bowl','Brown rice · edamame','Teriyaki salmon, brown rice, edamame, cucumber.',14.50,null,false,700,38,22,78),
  ('green-bowl','drinks','green-juice','Green Juice','Cold-pressed','Apple, kale, cucumber, lemon.',5.50,null,false,140,2,0,32),
  ('glaze-lab','donuts','glazed-box','Glazed Donut Box (6)','Classic glaze','Six classic glazed donuts.',12.00,'donut',true,1500,18,72,198),
  ('glaze-lab','coffee','cold-brew','Cold Brew','16 oz','18-hour cold brew.',4.50,null,false,10,0,0,0)
) v(r, c, s, n, sd, d, p, img, pop, kc, pr, ft, cb);

-- Options: (item key, option slug, name, type, required, min, max, sort)
insert into public.food_item_options (id, food_item_id, name, selection_type, is_required, min_selections, max_selections, sort_order)
select pg_temp.sid('o', i || ':' || s), pg_temp.sid('f', i), n, t, req, mn, mx, so from (values
  ('stack-smoke:double-smash','bun','Choose bun','single',true,1,1,1),
  ('stack-smoke:double-smash','addons','Add-ons','multiple',false,0,3,2),
  ('stack-smoke:smoky-bbq','bun','Choose bun','single',true,1,1,1),
  ('stack-smoke:truffle-fries','size','Size','single',true,1,1,1),
  ('stack-smoke:hot-wings','sauce','Sauce','single',true,1,1,1),
  ('stack-smoke:hot-wings','dip','Dip','multiple',false,0,2,2),
  ('kintsugi:spicy-shrimp','spice','Spice level','single',true,1,1,1),
  ('forno-napoli:margherita','size','Size','single',true,1,1,1),
  ('taqueria-lupe:street-tacos','protein','Protein','single',true,1,1,1)
) v(i, s, n, t, req, mn, mx, so);

-- Option values: (item key, option slug, value slug, name, price, sort)
insert into public.food_item_option_values (id, option_id, name, additional_price, sort_order)
select pg_temp.sid('v', i || ':' || o || ':' || s), pg_temp.sid('o', i || ':' || o), n, p, so from (values
  ('stack-smoke:double-smash','bun','brioche','Brioche',0,1), ('stack-smoke:double-smash','bun','potato','Potato bun',0,2), ('stack-smoke:double-smash','bun','lettuce','Lettuce wrap',0,3),
  ('stack-smoke:double-smash','addons','bacon','Smoked bacon',1.50,1), ('stack-smoke:double-smash','addons','cheese','Extra cheese',1.00,2), ('stack-smoke:double-smash','addons','jalapenos','Jalapeños',0.75,3),
  ('stack-smoke:smoky-bbq','bun','brioche','Brioche',0,1), ('stack-smoke:smoky-bbq','bun','potato','Potato bun',0,2),
  ('stack-smoke:truffle-fries','size','regular','Regular',0,1), ('stack-smoke:truffle-fries','size','large','Large',2.00,2),
  ('stack-smoke:hot-wings','sauce','buffalo','Buffalo',0,1), ('stack-smoke:hot-wings','sauce','chipotle','Chipotle glaze',0,2), ('stack-smoke:hot-wings','sauce','honey-garlic','Honey garlic',0,3),
  ('stack-smoke:hot-wings','dip','ranch','Ranch dip',0,1), ('stack-smoke:hot-wings','dip','blue-cheese','Blue cheese dip',0.50,2),
  ('kintsugi:spicy-shrimp','spice','mild','Mild',0,1), ('kintsugi:spicy-shrimp','spice','medium','Medium',0,2), ('kintsugi:spicy-shrimp','spice','hot','Hot',0,3),
  ('forno-napoli:margherita','size','12','12" · basil, mozzarella',0,1), ('forno-napoli:margherita','size','16','16" · basil, mozzarella',5.00,2),
  ('taqueria-lupe:street-tacos','protein','asada','Carne asada',0,1), ('taqueria-lupe:street-tacos','protein','pastor','Al pastor',0,2), ('taqueria-lupe:street-tacos','protein','veggie','Grilled veggie',0,3)
) v(i, o, s, n, p, so);

insert into public.promotions (code, description, percent_off, min_subtotal, first_order_only, per_user_limit, ends_at) values
  ('WELCOME10', '10% off your first order', 10, 15, true, 1, now() + interval '90 days');

-- ───── Orders (priced through the catalog so totals are consistent) ─────
create function pg_temp.seed_order(p_user uuid, p_restaurant text, p_items jsonb, p_status text, p_days_ago int, p_payment text, p_reason text default null)
returns uuid language plpgsql as $$
declare
  r public.restaurants;
  a public.addresses;
  it jsonb;
  oid uuid := gen_random_uuid();
  sub numeric := 0;
  unit numeric;
  opts jsonb;
  at timestamptz := date_trunc('day', now()) - make_interval(days => p_days_ago) + interval '19 hours 5 minutes';
  steps text[];
  s text;
  n int := 0;
  k text;
begin
  select * into r from public.restaurants where slug = p_restaurant;
  k := case r.slug when 'kintsugi-ramen' then 'kintsugi' else r.slug end;  -- catalog key used for seeded ids
  select * into a from public.addresses where user_id = p_user order by is_default desc limit 1;
  insert into public.orders (id, user_id, restaurant_id, restaurant_name_snapshot, restaurant_image_key, delivery_address_snapshot, customer_name_snapshot, customer_phone_snapshot,
    eta_min_minutes, eta_max_minutes, status, cancellation_reason, subtotal, delivery_fee, service_fee, discount_amount, total_amount, payment_method, payment_status, idempotency_key, placed_at, created_at)
  values (oid, p_user, r.id, r.name, r.image_key,
    coalesce(jsonb_build_object('label', a.label, 'address_line', a.address_line, 'unit', a.unit, 'city', a.city, 'postal_code', a.postal_code), '{"label":"home","address_line":"100 Congress Ave","unit":"","city":"Austin","postal_code":"78701"}'),
    coalesce(a.recipient_name, (select display_name from public.profiles where id = p_user)), coalesce(a.phone, '+1 (512) 555-0100'),
    r.eta_min_minutes, r.eta_max_minutes, p_status, p_reason, 0, r.delivery_fee, 0, 0, r.delivery_fee, p_payment,
    case when p_status = 'cancelled' then case when p_payment = 'demo_card' then 'demo_voided' else 'not_charged' end
         when p_payment = 'demo_card' then 'demo_authorized' when p_status = 'delivered' then 'paid' else 'due_on_delivery' end,
    gen_random_uuid(), at, at);
  for it in select * from jsonb_array_elements(p_items) loop
    select f.price + coalesce(sum(ov.additional_price), 0),
           coalesce(jsonb_agg(jsonb_build_object('option', op.name, 'value', ov.name, 'value_id', ov.id, 'price', ov.additional_price)) filter (where ov.id is not null), '[]')
      into unit, opts
    from public.food_items f
    left join public.food_item_options op on op.food_item_id = f.id
    left join public.food_item_option_values ov on ov.option_id = op.id and ov.id = any (array(select pg_temp.sid('v', k || ':' || (it ->> 'slug') || ':' || x) from jsonb_array_elements_text(it -> 'opts') x))
    where f.id = pg_temp.sid('f', k || ':' || (it ->> 'slug'))
    group by f.price;
    insert into public.order_items (order_id, food_item_id, item_name_snapshot, image_key_snapshot, unit_price_snapshot, quantity, selected_options_snapshot, line_total)
    select oid, f.id, f.name, f.image_key, unit, (it ->> 'qty')::int, opts, unit * (it ->> 'qty')::int
    from public.food_items f where f.id = pg_temp.sid('f', k || ':' || (it ->> 'slug'));
    sub := sub + unit * (it ->> 'qty')::int;
  end loop;
  update public.orders set subtotal = sub, service_fee = round(sub * 0.04, 2), total_amount = sub + delivery_fee + round(sub * 0.04, 2) where id = oid;
  steps := case p_status when 'delivered' then array['pending','confirmed','preparing','out_for_delivery','delivered']
                         when 'cancelled' then array['pending','cancelled'] else array['pending'] end;
  foreach s in array steps loop
    insert into public.order_status_history (order_id, status, note, created_at) values (oid, s, case when s = 'cancelled' then coalesce(p_reason, '') else '' end, at + make_interval(mins => n * 7));
    n := n + 1;
  end loop;
  return oid;
end $$;

-- Notifications from seeded history are noise; disable the trigger while seeding.
alter table public.order_status_history disable trigger on_order_status;

insert into public.addresses (user_id, label, recipient_name, phone, address_line, unit, city, postal_code, delivery_instructions, is_default) values
  ('c0000000-0000-4000-8000-000000000001', 'home', 'Ziah Makmur', '+1 (512) 555-0148', '214 Maple Ave', 'Apt 3B', 'Austin', '78704', 'Leave at door, ring once', true),
  ('c0000000-0000-4000-8000-000000000001', 'work', 'Ziah Makmur', '+1 (512) 555-0148', '600 Congress Ave', 'Floor 12', 'Austin', '78701', '', false);

-- Demo customer's history (no first order left, so WELCOME10 is not valid for this account).
select pg_temp.seed_order('c0000000-0000-4000-8000-000000000001', 'stack-smoke', '[{"slug":"double-smash","qty":2,"opts":["brioche"]},{"slug":"truffle-fries","qty":1,"opts":["regular"]},{"slug":"hot-wings","qty":1,"opts":["chipotle","ranch"]},{"slug":"lemonade","qty":1,"opts":[]}]', 'delivered', 14, 'demo_card');
select pg_temp.seed_order('c0000000-0000-4000-8000-000000000001', 'kintsugi-ramen', '[{"slug":"tonkotsu","qty":2,"opts":[]}]', 'delivered', 18, 'cash_on_delivery');
select pg_temp.seed_order('c0000000-0000-4000-8000-000000000001', 'forno-napoli', '[{"slug":"margherita","qty":1,"opts":["12"]},{"slug":"arrabbiata","qty":1,"opts":[]}]', 'cancelled', 23, 'demo_card', 'Forno Napoli couldn’t accept the order — kitchen closed early');

-- Reviewer accounts: delivered orders + reviews → real rating averages.
do $$
declare
  rv record;
  oid uuid;
begin
  for rv in select * from (values
    (1,'stack-smoke','double-smash',5,'Best smash burger in town.'), (2,'stack-smoke','double-smash',5,''), (3,'stack-smoke','crispy-chicken',4,'Great sauce.'), (4,'stack-smoke','double-smash',5,''),
    (1,'kintsugi-ramen','tonkotsu',5,'Rich broth.'), (2,'kintsugi-ramen','spicy-shrimp',4,''), (3,'kintsugi-ramen','tonkotsu',5,''),
    (4,'patty-theory','classic-beef',5,''), (5,'patty-theory','classic-beef',4,''),
    (5,'green-bowl','avocado-power',5,'Fresh and filling.'), (6,'green-bowl','avocado-power',4,''),
    (6,'taqueria-lupe','street-tacos',5,''), (1,'forno-napoli','margherita',4,''), (2,'glaze-lab','glazed-box',5,''), (3,'cluck-bun','cluck-classic',4,'')
  ) v(u, r, dish, rating, comment) loop
    oid := pg_temp.seed_order(('c0000000-0000-4000-8000-0000000001' || lpad(rv.u::text, 2, '0'))::uuid, rv.r,
      jsonb_build_array(jsonb_build_object('slug', rv.dish, 'qty', 1, 'opts',
        case rv.dish when 'double-smash' then '["brioche"]'::jsonb when 'spicy-shrimp' then '["medium"]' when 'margherita' then '["12"]' when 'street-tacos' then '["asada"]' else '[]' end)),
      'delivered', 30 + rv.u, 'cash_on_delivery');
    insert into public.reviews (order_id, user_id, restaurant_id, rating, comment)
    select oid, ('c0000000-0000-4000-8000-0000000001' || lpad(rv.u::text, 2, '0'))::uuid, restaurant_id, rv.rating, rv.comment from public.orders where id = oid;
  end loop;
end $$;

alter table public.order_status_history enable trigger on_order_status;

insert into public.favorite_restaurants (user_id, restaurant_id) values
  ('c0000000-0000-4000-8000-000000000001', pg_temp.sid('r','stack-smoke')),
  ('c0000000-0000-4000-8000-000000000001', pg_temp.sid('r','kintsugi')),
  ('c0000000-0000-4000-8000-000000000001', pg_temp.sid('r','green-bowl'));
insert into public.favorite_items (user_id, food_item_id) values
  ('c0000000-0000-4000-8000-000000000001', pg_temp.sid('f','stack-smoke:double-smash')),
  ('c0000000-0000-4000-8000-000000000001', pg_temp.sid('f','kintsugi:tonkotsu'));

insert into public.notifications (user_id, kind, title, body, link, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'promo', 'Free delivery on bowls', 'All week at Green Bowl Co. — no code needed', '/restaurants/green-bowl', now() - interval '1 day'),
  ('c0000000-0000-4000-8000-000000000001', 'review', 'Rate your Kintsugi Ramen order', 'Tell us how your order was', '/orders', now() - interval '17 days');
