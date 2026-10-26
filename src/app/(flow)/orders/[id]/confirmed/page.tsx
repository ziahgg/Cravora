import { Bike, Check, Navigation } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ButtonLink } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { estimatedArrival, PAYMENT_METHOD_LABEL } from '@/lib/domain/orders';
import { getOrder, viewer } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Order placed' };

/** Figma 08 Order confirmed. */
export default async function ConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const { db } = await viewer();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await getOrder(db, id);
  if (!o) notFound();
  const eta = estimatedArrival(o.placed_at, o.eta_max_minutes, o.scheduled_for);
  const time = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const a = o.delivery_address_snapshot;
  const rows: [string, string][] = [
    ['Order', o.order_number],
    ['Placed', new Date(o.placed_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })],
    ['Deliver to', `${a.address_line}${a.unit ? `, ${a.unit}` : ''}`],
    ['Paying with', PAYMENT_METHOD_LABEL[o.payment_method]],
    ['Total', formatMoney(o.total_amount)],
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-5 px-5 pt-[max(40px,env(safe-area-inset-top))] pb-36">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-36 place-items-center rounded-full bg-brand-soft">
          <span className="grid size-24 place-items-center rounded-full bg-brand text-on-brand">
            <Check size={44} strokeWidth={2.5} aria-hidden />
          </span>
        </span>
        <h1 className="t-display">Order placed!</h1>
        <p className="t-body text-text-secondary">{o.restaurant_name_snapshot} will confirm your order shortly.</p>
      </div>
      <section aria-label="Estimated arrival" className="flex items-center justify-between rounded-[28px] bg-ink p-5 text-on-ink">
        <div>
          <p className="t-body text-white/70">{o.scheduled_for ? 'Scheduled for' : 'Estimated arrival'}</p>
          <p className="t-display num">{time(eta)}</p>
          <p className="t-caption text-white/70">{o.scheduled_for ? 'Scheduled delivery' : `${o.eta_min_minutes}–${o.eta_max_minutes} min · restaurant estimate`}</p>
        </div>
        <span className="grid size-14 place-items-center rounded-full bg-brand text-on-brand">
          <Bike size={26} aria-hidden />
        </span>
      </section>
      <dl className="divide-y divide-divider rounded-[24px] bg-surface px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3.5">
            <dt className="t-body text-text-secondary">{k}</dt>
            <dd className="text-right t-body-m">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="t-caption text-text-muted">
        {o.items.reduce((s, i) => s + i.quantity, 0)} items · {o.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')}
      </p>
      {o.payment_method === 'demo_card' ? <p className="t-caption text-text-muted">Demo payment — no card was charged.</p> : null}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-[520px] gap-3">
          <ButtonLink href="/" variant="secondary" className="px-7">
            Home
          </ButtonLink>
          <ButtonLink href={`/orders/${o.id}`} icon={Navigation} full>
            Track order
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
