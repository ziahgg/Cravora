import { Banknote, CreditCard, Landmark, Lock, Wallet } from 'lucide-react';
import type { Metadata } from 'next';

import { Screen } from '@/components/screen';
import { TopBar } from '@/components/ui';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Payment methods' };

/** Figma 12d Payment methods — honest about what exists: no provider is connected and no cards are stored. */
export default async function PaymentMethodsPage() {
  await requireUser();
  const rows = [
    { icon: Banknote, title: 'Cash on delivery', sub: 'Pay the courier when your food arrives', on: true },
    { icon: CreditCard, title: 'Demo card', sub: 'Test checkout only — never charges a card', on: true },
    { icon: Wallet, title: 'Cravora Wallet', sub: 'Not available yet', on: false },
    { icon: Landmark, title: 'Cards & bank transfer', sub: 'Not available yet', on: false },
  ];
  return (
    <Screen>
      <TopBar title="Payment methods" back="/profile" />
      <p className="t-body text-text-secondary">Choose a method at checkout.</p>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.title} className={`flex items-center gap-4 rounded-[24px] bg-surface p-4 ${r.on ? '' : 'opacity-60'}`}>
            <span className="grid size-12 place-items-center rounded-[14px] bg-surface-muted">
              <r.icon size={22} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="t-card-title block">{r.title}</span>
              <span className="t-caption text-text-muted">{r.sub}</span>
            </span>
            {r.on ? null : <span className="rounded-full bg-surface-muted px-2.5 py-1 t-caption-m">Soon</span>}
          </li>
        ))}
      </ul>
      <p className="flex gap-2 rounded-[16px] bg-surface-muted p-3 t-caption text-text-secondary">
        <Lock size={16} className="shrink-0" aria-hidden /> No payment provider is connected and Cravora never stores card numbers. Adding real card payments needs a provider such as Stripe with server-side confirmation and webhooks.
      </p>
    </Screen>
  );
}
