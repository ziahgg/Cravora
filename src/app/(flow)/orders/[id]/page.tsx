import { Bike, Check, ChefHat, CircleCheck, CircleHelp, ReceiptText, Store, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AutoRefresh, CancelOrderButton, ReorderButton, ReviewForm } from '@/components/order-actions';
import { PriceBreakdown } from '@/components/price-breakdown';
import { IconButton, TopBar, cx } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { customerCanCancel, estimatedArrival, HISTORY_TITLE, isActive, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, TRACK_STEPS } from '@/lib/domain/orders';
import { getOrder, viewer } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Order' };

const time = (iso: string | Date) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const STEP_ICON = [ReceiptText, ChefHat, Bike, CircleCheck];

/** Illustrative route graphic (no live courier location is available). */
function RouteIllustration() {
  return (
    <figure className="relative overflow-hidden rounded-[28px] bg-map" aria-label="Illustrative route from the restaurant to your address">
      <svg viewBox="0 0 360 200" className="h-auto w-full" aria-hidden>
        {[30, 110, 190].map((y) => (
          <rect key={y} x="0" y={y} width="360" height="14" fill="var(--map-road)" />
        ))}
        {[60, 170, 280].map((x) => (
          <rect key={x} x={x} y="0" width="14" height="200" fill="var(--map-road)" />
        ))}
        {[
          [80, 50],
          [190, 50],
          [80, 130],
          [190, 130],
          [300, 50],
        ].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="80" height="50" rx="8" fill="var(--map-block)" />
        ))}
        <path d="M67 160 V117 H177 V37 H287" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="round" />
        <circle cx="67" cy="160" r="16" fill="var(--ink)" />
        <circle cx="287" cy="37" r="16" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
      </svg>
      <figcaption className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 t-caption text-text-secondary">Map is illustrative — live courier location isn’t available</figcaption>
    </figure>
  );
}

/** Figma 09 tracking, 09b details, 09c delivered, 10c cancelled. Progress = real status history. */
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const { db } = await viewer();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await getOrder(db, id);
  if (!o) notFound();
  const active = isActive(o.status);
  const eta = estimatedArrival(o.placed_at, o.eta_max_minutes, o.scheduled_for);
  const reached = (s: string) => o.history.find((h) => h.status === s);
  const a = o.delivery_address_snapshot;
  const count = o.items.reduce((s, i) => s + i.quantity, 0);

  const headline =
    o.status === 'cancelled'
      ? `Cancelled · ${day(o.updated_at)}`
      : o.status === 'delivered'
        ? `Delivered · ${time(reached('delivered')?.created_at ?? o.updated_at)}`
        : o.status === 'out_for_delivery'
          ? `On the way · arriving ~${time(eta)}`
          : o.status === 'pending'
            ? `Waiting for ${o.restaurant_name_snapshot} to confirm`
            : `Being prepared · arriving ~${time(eta)}`;

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-12">
      {active ? <AutoRefresh /> : null}
      <TopBar title={`Order ${o.order_number}`} back="/orders" right={<IconButton icon={CircleHelp} label="Help with this order" href={`/help?order=${o.id}`} />} />

      <section aria-label="Status" className={cx('flex items-center gap-4 rounded-[24px] p-4', o.status === 'cancelled' ? 'bg-surface-muted' : 'bg-ink text-on-ink')}>
        <span className={cx('grid size-12 shrink-0 place-items-center rounded-full', o.status === 'cancelled' ? 'bg-ink text-on-ink' : 'bg-brand text-on-brand')}>
          {o.status === 'cancelled' ? <X size={22} aria-hidden /> : o.status === 'delivered' ? <Check size={22} aria-hidden /> : <Bike size={22} aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="t-card-title">{headline}</p>
          <p className={cx('t-caption', o.status === 'cancelled' ? 'text-text-secondary' : 'text-white/70')}>
            {o.status === 'cancelled' ? o.cancellation_reason : o.scheduled_for ? `Scheduled for ${day(o.scheduled_for)} ${time(o.scheduled_for)}` : `${o.restaurant_name_snapshot} · estimate ${o.eta_min_minutes}–${o.eta_max_minutes} min`}
          </p>
        </div>
      </section>

      {o.status === 'cancelled' ? (
        <p className="rounded-[20px] bg-success-soft p-4 t-body">{PAYMENT_STATUS_LABEL[o.payment_status]}.</p>
      ) : (
        <>
          {active ? <RouteIllustration /> : null}
          <ol className="flex items-start justify-between" aria-label="Progress">
            {TRACK_STEPS.map((s, i) => {
              const done = s.reached(o.status);
              const current = done && !TRACK_STEPS[i + 1]?.reached(o.status);
              const Icon = STEP_ICON[i];
              return (
                <li key={s.key} className="flex flex-1 flex-col items-center gap-2 text-center" aria-current={current ? 'step' : undefined}>
                  <span className={cx('grid size-12 place-items-center rounded-full', done ? 'bg-brand text-on-brand' : 'bg-surface-muted text-text-muted', current && 'ring-2 ring-ink')}>
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className={cx('t-caption', current ? 't-caption-m text-text' : 'text-text-muted')}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <section aria-label="Timeline" className="rounded-[24px] bg-surface p-4">
        <ol className="flex flex-col">
          {o.history.map((h, i) => (
            <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
              {i < o.history.length - 1 ? <span className="absolute top-10 left-5 h-[calc(100%-36px)] w-0.5 bg-ink" aria-hidden /> : null}
              <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', h.status === 'cancelled' ? 'bg-ink text-on-ink' : 'bg-brand text-on-brand')}>
                {h.status === 'cancelled' ? <X size={18} aria-hidden /> : <Check size={18} aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <p className="t-card-title">{HISTORY_TITLE[h.status]}</p>
                  <time className="t-caption text-text-muted" dateTime={h.created_at}>
                    {time(h.created_at)}
                  </time>
                </div>
                <p className="t-caption text-text-muted">
                  {h.status === 'pending' ? `${PAYMENT_METHOD_LABEL[o.payment_method]} · ${formatMoney(o.total_amount)}` : h.status === 'confirmed' ? `${o.restaurant_name_snapshot} accepted your order` : h.note || ''}
                </p>
              </div>
            </li>
          ))}
          {active ? (
            <li className="flex gap-4 pt-5 opacity-60">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted">
                <CircleCheck size={18} aria-hidden />
              </span>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="t-card-title">Delivered</p>
                  <span className="t-caption text-text-muted">~{time(eta)}</span>
                </div>
                <p className="t-caption text-text-muted">{`${a.address_line}${a.unit ? `, ${a.unit}` : ''}`}</p>
              </div>
            </li>
          ) : null}
        </ol>
      </section>

      <section aria-labelledby="items-h" className="flex flex-col gap-3">
        <h2 id="items-h" className="t-title">
          Items
        </h2>
        <ul className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
          {o.items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <span className="t-card-title text-brand-ink num">{i.quantity}×</span>
              <span className="min-w-0 flex-1">
                <span className="t-card-title block">{i.item_name_snapshot}</span>
                {i.selected_options_snapshot.length ? <span className="t-caption text-text-muted">{i.selected_options_snapshot.map((x) => (Number(x.price) > 0 ? `+ ${x.value}` : x.value)).join(' · ')}</span> : null}
              </span>
              <span className="t-price-s num">{formatMoney(i.line_total)}</span>
            </li>
          ))}
        </ul>
      </section>

      <PriceBreakdown count={count} subtotal={o.subtotal} deliveryFee={o.delivery_fee} freeDelivery={Number(o.delivery_fee) === 0} serviceFee={o.service_fee} discount={o.discount_amount} promoCode={o.promo_code} total={o.total_amount} />

      <dl className="flex flex-col gap-2 rounded-[24px] bg-surface p-4 t-body">
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Payment</dt>
          <dd className="text-right t-body-m">{PAYMENT_METHOD_LABEL[o.payment_method]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Status</dt>
          <dd className="text-right">{PAYMENT_STATUS_LABEL[o.payment_status]}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-text-secondary">Deliver to</dt>
          <dd className="text-right">
            {o.customer_name_snapshot} · {a.address_line}
            {a.unit ? `, ${a.unit}` : ''}, {a.city} {a.postal_code}
          </dd>
        </div>
        {o.delivery_instructions ? (
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Note</dt>
            <dd className="text-right">{o.delivery_instructions}</dd>
          </div>
        ) : null}
      </dl>

      {o.status === 'delivered' && !o.review ? <ReviewForm orderId={o.id} restaurant={o.restaurant_name_snapshot} /> : null}
      {o.review ? <p className="rounded-[20px] bg-surface p-4 t-body text-text-secondary">You rated this order {o.review.rating}/5. Thanks!</p> : null}

      <div className="flex flex-col gap-3">
        {customerCanCancel(o.status) ? <CancelOrderButton orderId={o.id} /> : null}
        {!active ? <ReorderButton orderId={o.id} label="Order again" full /> : null}
        {o.restaurant_id ? (
          <Link href={`/help?order=${o.id}`} className="inline-flex items-center justify-center gap-2 t-body-m text-text-secondary">
            <Store size={16} aria-hidden /> Get help with this order
          </Link>
        ) : null}
      </div>
    </main>
  );
}
