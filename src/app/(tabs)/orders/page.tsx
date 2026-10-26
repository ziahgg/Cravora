import { Navigation, ReceiptText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FoodImage } from '@/components/cards';
import { ReorderButton } from '@/components/order-actions';
import { Screen } from '@/components/screen';
import { ButtonLink, EmptyState, Tag, cx } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { isActive, STATUS_LABEL } from '@/lib/domain/orders';
import { listOrders, viewer, type OrderSummary } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Orders' };

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Figma 10 Order history (+ 10b reorder). */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { db, userId } = await viewer();
  if (!userId) redirect('/login?next=/orders');
  const orders = await listOrders(db, userId);
  const active = orders.filter((o) => isActive(o.status));
  const past = orders.filter((o) => !isActive(o.status));
  const showPast = tab === 'past';

  const card = (o: OrderSummary) => (
    <li key={o.id} className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
      <Link href={`/orders/${o.id}`} className="flex items-center gap-3">
        <FoodImage imageKey={o.restaurant_image_key} alt="" sizes="56px" className="size-14 shrink-0 rounded-[14px]" />
        <span className="min-w-0 flex-1">
          <span className="t-card-title block truncate">{o.restaurant_name_snapshot}</span>
          <span className="t-caption block text-text-muted">
            {when(o.placed_at)} · {o.order_number}
          </span>
        </span>
        <Tag tone={o.status === 'delivered' ? 'success' : o.status === 'cancelled' ? 'neutral' : 'brand'}>{STATUS_LABEL[o.status]}</Tag>
      </Link>
      <p className="truncate border-b border-divider pb-3 t-body text-text-secondary">{o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')}</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="t-caption text-text-muted">Total</p>
          <p className="t-price num">{formatMoney(o.total_amount)}</p>
        </div>
        {isActive(o.status) ? (
          <ButtonLink href={`/orders/${o.id}`} variant="dark" size="sm" icon={Navigation}>
            Track order
          </ButtonLink>
        ) : (
          <ReorderButton orderId={o.id} />
        )}
      </div>
    </li>
  );

  return (
    <Screen>
      <h1 className="t-title-xl">Orders</h1>
      <div role="tablist" aria-label="Orders" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        <Link role="tab" aria-selected={!showPast} href="/orders" className={cx('grid h-12 place-items-center rounded-full t-button-s', !showPast ? 'bg-ink text-on-ink' : 'text-text-secondary')}>
          All · {orders.length}
        </Link>
        <Link role="tab" aria-selected={showPast} href="/orders?tab=past" className={cx('grid h-12 place-items-center rounded-full t-button-s', showPast ? 'bg-ink text-on-ink' : 'text-text-secondary')}>
          Past · {past.length}
        </Link>
      </div>
      {!orders.length ? (
        <EmptyState icon={ReceiptText} title="No orders yet" message="When you place an order, you can track it and reorder from here." action={<ButtonLink href="/" size="sm">Find food</ButtonLink>} />
      ) : (
        <>
          {!showPast && active.length ? (
            <section aria-label="In progress" className="flex flex-col gap-3">
              <h2 className="t-body text-text-secondary">In progress</h2>
              <ul className="flex flex-col gap-3">{active.map(card)}</ul>
            </section>
          ) : null}
          {past.length ? (
            <section aria-label="Past orders" className="flex flex-col gap-3">
              <h2 className="t-body text-text-secondary">Past orders</h2>
              <ul className="flex flex-col gap-3">{past.map(card)}</ul>
            </section>
          ) : showPast ? (
            <p className="t-body text-text-secondary">No past orders yet.</p>
          ) : null}
        </>
      )}
    </Screen>
  );
}
