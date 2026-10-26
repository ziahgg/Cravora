import { Bike, ChevronDown, CreditCard, Mail, Package, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FoodImage } from '@/components/cards';
import { Screen } from '@/components/screen';
import { Tag, TopBar } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { STATUS_LABEL } from '@/lib/domain/orders';
import { listOrders, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Help center' };

const TOPICS = [
  { id: 'order', label: 'Order issue', icon: Package },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'delivery', label: 'Delivery', icon: Bike },
] as const;

const FAQ: { topic: (typeof TOPICS)[number]['id']; q: string; a: string }[] = [
  { topic: 'delivery', q: 'My order is late', a: 'Delivery times are the restaurant’s estimate. Open the order to see its latest status — it updates as the restaurant confirms, prepares and hands it to the courier.' },
  { topic: 'order', q: 'Can I cancel my order?', a: 'You can cancel while the order is still waiting for the restaurant to confirm (status “Placed”). After that, the restaurant has started on it.' },
  { topic: 'order', q: 'An item was missing or wrong', a: 'Contact the restaurant directly with your order number. In-app refunds aren’t available yet.' },
  { topic: 'payment', q: 'How do refunds work?', a: 'No payment provider is connected yet. Cash orders are paid to the courier on delivery, so a cancelled cash order is never charged. The demo card never moves money.' },
  { topic: 'payment', q: 'Is my card stored?', a: 'No. Cravora doesn’t store card numbers. Card payments will use a certified payment provider when they launch.' },
  { topic: 'delivery', q: 'Change my delivery address', a: 'Before placing an order, pick or add an address at checkout. After an order is placed its address can’t be changed — cancel while it’s still “Placed” and order again.' },
];

/** Figma 12e Help center. Static, searchable answers + your latest order. */
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 60);
  const topic = TOPICS.some((t) => t.id === sp.topic) ? sp.topic : null;
  const { db, userId } = await viewer();
  const latest = userId ? (await listOrders(db, userId, 1))[0] : undefined;
  const list = FAQ.filter((f) => (!topic || f.topic === topic) && (!q || `${f.q} ${f.a}`.toLowerCase().includes(q)));
  return (
    <Screen>
      <TopBar title="Help center" back={userId ? '/profile' : '/'} />
      <form action="/help" role="search" className="flex h-14 items-center gap-3 rounded-full bg-surface px-5">
        <Search size={18} className="text-text-muted" aria-hidden />
        <label htmlFor="help-q" className="sr-only">
          Search help articles
        </label>
        <input id="help-q" name="q" type="search" defaultValue={sp.q} placeholder="Search help articles" className="h-full flex-1 bg-transparent t-item outline-none placeholder:text-text-muted" />
      </form>
      <nav aria-label="Topics" className="grid grid-cols-3 gap-3">
        {TOPICS.map((t) => (
          <Link key={t.id} href={topic === t.id ? '/help' : `/help?topic=${t.id}`} aria-current={topic === t.id ? 'true' : undefined} className={`flex flex-col gap-3 rounded-[24px] p-4 ${topic === t.id ? 'bg-ink text-on-ink' : 'bg-surface'}`}>
            <span className="grid size-10 place-items-center rounded-full bg-brand text-on-brand">
              <t.icon size={20} aria-hidden />
            </span>
            <span className="t-card-title">{t.label}</span>
          </Link>
        ))}
      </nav>
      {latest ? (
        <section aria-labelledby="recent-h" className="flex flex-col gap-3">
          <h2 id="recent-h" className="t-section">
            Recent order
          </h2>
          <Link href={`/orders/${latest.id}`} className="flex items-center gap-3 rounded-[24px] bg-surface p-4">
            <FoodImage imageKey={latest.restaurant_image_key} alt="" sizes="56px" className="size-14 shrink-0 rounded-[14px]" />
            <span className="min-w-0 flex-1">
              <span className="t-card-title block truncate">{latest.restaurant_name_snapshot}</span>
              <span className="t-caption text-text-muted">
                {latest.order_number} · {formatMoney(latest.total_amount)}
              </span>
            </span>
            <Tag tone="brand">{STATUS_LABEL[latest.status]}</Tag>
          </Link>
        </section>
      ) : null}
      <section aria-labelledby="faq-h" className="flex flex-col gap-3">
        <h2 id="faq-h" className="t-section">
          {q || topic ? `Answers · ${list.length}` : 'Popular questions'}
        </h2>
        <div className="divide-y divide-divider overflow-hidden rounded-[24px] bg-surface">
          {list.map((f) => (
            <details key={f.q} className="group px-4">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 t-item">
                {f.q}
                <ChevronDown size={18} className="shrink-0 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="pb-4 t-body text-text-secondary">{f.a}</p>
            </details>
          ))}
          {!list.length ? <p className="p-4 t-body text-text-secondary">No answers match. Try other words.</p> : null}
        </div>
      </section>
      <p className="flex items-center gap-2 t-caption text-text-muted">
        <Mail size={14} aria-hidden /> Live chat with support isn’t available yet.
      </p>
    </Screen>
  );
}
