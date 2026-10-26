import { Store } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { OwnerOrderActions } from '@/components/owner-actions';
import { AutoRefresh } from '@/components/order-actions';
import { Screen } from '@/components/screen';
import { EmptyState, Tag, TopBar } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { isActive, PAYMENT_METHOD_LABEL, STATUS_LABEL } from '@/lib/domain/orders';
import { managedRestaurants, restaurantOrders } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Restaurant orders' };

/**
 * Minimal order queue for restaurant owners — needed so order status/tracking has a real source.
 * Access is role-checked here and enforced again by RLS and update_order_status().
 */
export default async function RestaurantOrdersPage() {
  const { supabase, userId } = await requireUser();
  const restaurants = await managedRestaurants(supabase, userId);
  if (!restaurants.length) notFound();
  const orders = await restaurantOrders(supabase, restaurants.map((r) => r.id));
  const open = orders.filter((o) => isActive(o.status));
  const done = orders.filter((o) => !isActive(o.status)).slice(0, 20);
  const card = (o: (typeof orders)[number]) => (
    <li key={o.id} className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-card-title">
            {o.order_number} · {o.restaurant_name_snapshot}
          </p>
          <p className="t-caption text-text-muted">
            {new Date(o.placed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {o.customer_name_snapshot} · {PAYMENT_METHOD_LABEL[o.payment_method]}
          </p>
        </div>
        <Tag tone={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'neutral' : 'brand'}>{STATUS_LABEL[o.status]}</Tag>
      </div>
      <p className="t-body text-text-secondary">{o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="t-price num">{formatMoney(o.total_amount)}</span>
        {isActive(o.status) ? <OwnerOrderActions orderId={o.id} status={o.status} /> : null}
      </div>
    </li>
  );
  return (
    <Screen>
      <AutoRefresh seconds={15} />
      <TopBar title="Restaurant orders" back="/profile" />
      <p className="t-body text-text-secondary">{restaurants.map((r) => r.name).join(', ')}</p>
      {open.length ? <ul className="flex flex-col gap-3">{open.map(card)}</ul> : <EmptyState icon={Store} title="No open orders" message="New orders appear here automatically." />}
      {done.length ? (
        <section aria-label="Recent" className="flex flex-col gap-3">
          <h2 className="t-section">Recent</h2>
          <ul className="flex flex-col gap-3">{done.map(card)}</ul>
        </section>
      ) : null}
    </Screen>
  );
}
