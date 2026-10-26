/**
 * Typed schema for supabase-js, matching supabase/migrations (generator-compatible shape).
 * Regenerate with `npm run db:types` and compare when the schema changes.
 */

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash_on_delivery' | 'demo_card';
export type PaymentStatus = 'due_on_delivery' | 'paid' | 'demo_authorized' | 'demo_voided' | 'not_charged';
export type AddressLabel = 'home' | 'work' | 'other';

/** numeric columns arrive from PostgREST as numbers (JSON) — they are converted with toCents() before arithmetic. */
type Money = number | string;

export type ProfileRow = { id: string; display_name: string; phone: string | null; order_updates: boolean; promo_offers: boolean; created_at: string; updated_at: string };
export type AddressRow = {
  id: string;
  user_id: string;
  label: AddressLabel;
  recipient_name: string;
  phone: string;
  address_line: string;
  unit: string;
  city: string;
  postal_code: string;
  delivery_instructions: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};
export type RestaurantRow = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string;
  description: string;
  cuisine: string;
  tags: string[];
  price_level: number;
  image_key: string | null;
  address: string;
  delivery_fee: Money;
  free_delivery_until: string | null;
  min_order: Money;
  eta_min_minutes: number;
  eta_max_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type CategoryRow = { id: string; restaurant_id: string; name: string; slug: string; sort_order: number; is_active: boolean };
export type FoodItemRow = {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  image_key: string | null;
  price: Money;
  is_available: boolean;
  is_popular: boolean;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  created_at: string;
  updated_at: string;
};
export type OptionRow = { id: string; food_item_id: string; name: string; selection_type: 'single' | 'multiple'; is_required: boolean; min_selections: number; max_selections: number; sort_order: number };
export type OptionValueRow = { id: string; option_id: string; name: string; additional_price: Money; is_available: boolean; sort_order: number };
export type FavoriteRestaurantRow = { user_id: string; restaurant_id: string; created_at: string };
export type FavoriteItemRow = { user_id: string; food_item_id: string; created_at: string };
export type CartRow = { user_id: string; restaurant_id: string | null; promo_code: string | null; updated_at: string };
export type CartItemRow = { id: string; user_id: string; food_item_id: string; quantity: number; options_key: string; created_at: string; updated_at: string };
export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  restaurant_id: string | null;
  restaurant_name_snapshot: string;
  restaurant_image_key: string | null;
  delivery_address_snapshot: { label: AddressLabel; address_line: string; unit: string; city: string; postal_code: string };
  customer_name_snapshot: string;
  customer_phone_snapshot: string;
  delivery_instructions: string;
  scheduled_for: string | null;
  eta_min_minutes: number;
  eta_max_minutes: number;
  status: OrderStatus;
  cancellation_reason: string | null;
  subtotal: Money;
  delivery_fee: Money;
  service_fee: Money;
  discount_amount: Money;
  total_amount: Money;
  promo_code: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  idempotency_key: string;
  placed_at: string;
  created_at: string;
  updated_at: string;
};
export type SelectedOption = { option: string; value: string; value_id: string; price: Money };
export type OrderItemRow = {
  id: string;
  order_id: string;
  food_item_id: string | null;
  item_name_snapshot: string;
  image_key_snapshot: string | null;
  unit_price_snapshot: Money;
  quantity: number;
  selected_options_snapshot: SelectedOption[];
  line_total: Money;
  created_at: string;
};
export type OrderHistoryRow = { id: string; order_id: string; status: OrderStatus; note: string; changed_by: string | null; created_at: string };
export type ReviewRow = { id: string; order_id: string; user_id: string; restaurant_id: string; rating: number; comment: string; created_at: string };
export type RatingRow = { restaurant_id: string; rating: Money; review_count: number };
export type NotificationRow = { id: string; user_id: string; kind: 'order' | 'promo' | 'review'; title: string; body: string; link: string | null; read_at: string | null; created_at: string };
export type UserRoleRow = { user_id: string; role: 'restaurant_owner' | 'admin'; created_at: string };

/** quote_cart() result. */
export type CartQuote =
  | { items: []; count: 0 }
  | {
      restaurant: { id: string; name: string; slug: string; image_key: string | null; eta_min: number; eta_max: number; min_order: number };
      items: {
        cart_item_id: string;
        food_item_id: string;
        name: string;
        image_key: string | null;
        quantity: number;
        option_ids: string[];
        options: SelectedOption[];
        unit_price: number;
        line_total: number;
        issue: string | null;
      }[];
      count: number;
      subtotal: number;
      delivery_fee: number;
      free_delivery: boolean;
      service_fee: number;
      promo: { code: string; applied: boolean; message: string | null; discount: number } | null;
      discount: number;
      total: number;
      has_issues: boolean;
      below_minimum: boolean;
    };

type Insertable<R, Req extends keyof R> = Pick<R, Req> & Partial<Omit<R, Req>>;
type Table<R, Req extends keyof R> = { Row: R; Insert: Insertable<R, Req>; Update: Partial<R>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id'>;
      addresses: Table<AddressRow, 'user_id' | 'recipient_name' | 'phone' | 'address_line' | 'city' | 'postal_code'>;
      restaurants: Table<RestaurantRow, 'name' | 'slug' | 'cuisine'>;
      food_categories: Table<CategoryRow, 'restaurant_id' | 'name' | 'slug'>;
      food_items: Table<FoodItemRow, 'restaurant_id' | 'category_id' | 'name' | 'slug' | 'price'>;
      food_item_options: Table<OptionRow, 'food_item_id' | 'name' | 'selection_type'>;
      food_item_option_values: Table<OptionValueRow, 'option_id' | 'name'>;
      favorite_restaurants: Table<FavoriteRestaurantRow, 'user_id' | 'restaurant_id'>;
      favorite_items: Table<FavoriteItemRow, 'user_id' | 'food_item_id'>;
      carts: Table<CartRow, 'user_id'>;
      cart_items: Table<CartItemRow, 'user_id' | 'food_item_id' | 'quantity'>;
      orders: Table<OrderRow, never>;
      order_items: Table<OrderItemRow, never>;
      order_status_history: Table<OrderHistoryRow, never>;
      reviews: Table<ReviewRow, 'order_id' | 'user_id' | 'restaurant_id' | 'rating'>;
      notifications: Table<NotificationRow, never>;
      user_roles: Table<UserRoleRow, never>;
    };
    Views: {
      restaurant_ratings: { Row: RatingRow; Relationships: [] };
    };
    Functions: {
      cart_add: { Args: { p_item: string; p_quantity: number; p_option_values: string[]; p_replace: boolean }; Returns: { status: 'added' | 'conflict' | 'invalid'; message?: string; current_restaurant?: string; count?: number } };
      quote_cart: { Args: Record<string, never>; Returns: CartQuote };
      place_order: { Args: { p_address_id: string; p_payment_method: PaymentMethod; p_idempotency_key: string; p_scheduled_for?: string | null; p_instructions?: string | null }; Returns: string };
      update_order_status: { Args: { p_order_id: string; p_status: OrderStatus; p_note?: string | null }; Returns: undefined };
      reorder: { Args: { p_order_id: string }; Returns: { added: number; skipped: number } };
      set_default_address: { Args: { p_address_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
