'use client';

import { Banknote, Briefcase, CreditCard, House, Landmark, Lock, MapPin, MessageCircle, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { placeOrder } from '@/app/actions/shop';
import { formatMoney } from '@/lib/domain/money';
import type { AddressRow, CartQuote, PaymentMethod } from '@/types/database';
import { Sheet } from './overlays';
import { PriceBreakdown } from './price-breakdown';
import { useToast } from './toast';
import { Button, FieldMessage, FormError, TopBar, cx } from './ui';

type Quote = Extract<CartQuote, { restaurant: unknown }>;
const LABEL_ICON = { home: House, work: Briefcase, other: MapPin };

const addressLine = (a: AddressRow) => `${a.address_line}${a.unit ? `, ${a.unit}` : ''}, ${a.city} ${a.postal_code}`;
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function CheckoutForm({ quote, addresses }: { quote: Quote; addresses: AddressRow[]; profileName: string }) {
  const router = useRouter();
  const toast = useToast();
  const ids = { notes: useId(), when: useId() };
  // One key per checkout visit: retries and double taps return the same order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null);
  const [pendingAddress, setPendingAddress] = useState(addressId);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<'standard' | 'schedule'>('standard');
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 90 * 60_000)));
  const [method, setMethod] = useState<PaymentMethod>('cash_on_delivery');
  const address = addresses.find((a) => a.id === addressId);
  const [notes, setNotes] = useState(address?.delivery_instructions ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (!addressId) return setFormError('Add a delivery address first.');
      const r = await placeOrder({
        addressId,
        paymentMethod: method,
        idempotencyKey,
        scheduledFor: mode === 'schedule' ? new Date(when).toISOString() : null,
        instructions: notes.trim() || null,
      });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.fields ? 'Please check the highlighted fields.' : r.error);
        return;
      }
      toast({ title: 'Order placed', message: quote.restaurant.name });
      router.replace(`/orders/${r.data.orderId}/confirmed`);
    });

  const card = (on: boolean) => cx('flex w-full items-center gap-4 rounded-[24px] bg-surface p-4 text-left', on ? 'ring-[1.5px] ring-ink' : 'border border-border');
  const radio = (on: boolean) => (
    <span className={cx('grid size-7 shrink-0 place-items-center rounded-full', on ? 'bg-ink' : 'border-2 border-disabled')} aria-hidden>
      {on ? <span className="size-3 rounded-full bg-brand" /> : null}
    </span>
  );

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <TopBar title="Checkout" back="/cart" />
      <FormError message={formError} />

      <section aria-labelledby="to-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="to-h" className="t-section">
            Deliver to
          </h2>
          {addresses.length ? (
            <button type="button" onClick={() => (setPendingAddress(addressId), setSheet(true))} className="t-label text-brand-ink">
              Change
            </button>
          ) : null}
        </div>
        {address ? (
          <div className={card(true)}>
            {(() => {
              const Icon = LABEL_ICON[address.label];
              return (
                <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-brand text-on-brand">
                  <Icon size={22} aria-hidden />
                </span>
              );
            })()}
            <span className="min-w-0 flex-1">
              <span className="t-card-title block capitalize">{address.label}</span>
              <span className="t-caption block text-text-muted">{addressLine(address)}</span>
            </span>
            {radio(true)}
          </div>
        ) : (
          <Link href="/addresses/new?next=/checkout" className="flex h-16 items-center justify-center gap-2 rounded-[24px] border-[1.5px] border-dashed border-disabled t-button-s">
            <Plus size={18} aria-hidden /> Add a delivery address
          </Link>
        )}
      </section>

      <section aria-labelledby="time-h" className="flex flex-col gap-3">
        <h2 id="time-h" className="t-section">
          Delivery time
        </h2>
        <div role="radiogroup" aria-labelledby="time-h" className="grid grid-cols-2 gap-3">
          <button type="button" role="radio" aria-checked={mode === 'standard'} onClick={() => setMode('standard')} className={cx(card(mode === 'standard'), 'flex-col items-start gap-0')}>
            <span className="t-card-title">Standard</span>
            <span className="t-caption text-text-muted">
              {quote.restaurant.eta_min}–{quote.restaurant.eta_max} min
            </span>
          </button>
          <button type="button" role="radio" aria-checked={mode === 'schedule'} onClick={() => setMode('schedule')} className={cx(card(mode === 'schedule'), 'flex-col items-start gap-0')}>
            <span className="t-card-title">Schedule</span>
            <span className="t-caption text-text-muted">Pick a time</span>
          </button>
        </div>
        {mode === 'schedule' ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.when} className="t-label text-text-secondary">
              Deliver at (30 min – 7 days from now)
            </label>
            <input id={ids.when} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-12 rounded-[16px] border border-border bg-surface px-4 t-item" aria-describedby={`${ids.when}-m`} />
            <FieldMessage id={`${ids.when}-m`} error={errors.scheduledFor} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="contact-h" className="flex flex-col gap-3">
        <h2 id="contact-h" className="t-section">
          Contact &amp; instructions
        </h2>
        <div className="flex flex-col gap-3 rounded-[24px] bg-surface p-4">
          <p className="t-body text-text-secondary">
            {address ? (
              <>
                <span className="t-item text-text">{address.recipient_name}</span> · {address.phone}
              </>
            ) : (
              'Add an address with a contact name and phone number.'
            )}
          </p>
          <label htmlFor={ids.notes} className="flex items-center gap-2 t-label text-text-secondary">
            <MessageCircle size={16} aria-hidden /> Note for the courier
          </label>
          <input id={ids.notes} value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Leave at door, ring once" className="h-12 rounded-[16px] border border-border px-4 t-item outline-none focus:border-ink" />
        </div>
      </section>

      <section aria-labelledby="pay-h" className="flex flex-col gap-3">
        <h2 id="pay-h" className="t-section">
          Payment method
        </h2>
        <div role="radiogroup" aria-labelledby="pay-h" className="flex flex-col gap-3">
          {(
            [
              ['cash_on_delivery', Banknote, 'Cash on delivery', 'Pay the courier · exact change helps'],
              ['demo_card', CreditCard, 'Demo card', 'For testing only — no card is charged'],
            ] as const
          ).map(([id, Icon, title, sub]) => (
            <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)} className={card(method === id)}>
              <span className={cx('grid size-12 shrink-0 place-items-center rounded-[14px]', method === id ? 'bg-brand text-on-brand' : 'bg-surface-muted')}>
                <Icon size={22} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-card-title block">{title}</span>
                <span className="t-caption block text-text-muted">{sub}</span>
              </span>
              {radio(method === id)}
            </button>
          ))}
          <div className="flex items-center gap-4 rounded-[24px] border border-border bg-surface p-4 opacity-60" aria-disabled="true">
            <span className="grid size-12 place-items-center rounded-[14px] bg-surface-muted">
              <Landmark size={22} aria-hidden />
            </span>
            <span className="flex-1">
              <span className="t-card-title block">Cards &amp; wallets</span>
              <span className="t-caption text-text-muted">Not available yet</span>
            </span>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 t-caption-m">Soon</span>
          </div>
          <p className="flex items-center gap-2 rounded-[16px] bg-surface-muted p-3 t-caption text-text-secondary">
            <Lock size={16} aria-hidden /> No payment provider is connected. Cash is collected by the courier; the demo card never moves money.
          </p>
        </div>
      </section>

      <PriceBreakdown count={quote.count} subtotal={quote.subtotal} deliveryFee={quote.delivery_fee} freeDelivery={quote.free_delivery} serviceFee={quote.service_fee} discount={quote.discount} promoCode={quote.promo?.applied ? quote.promo.code : null} total={quote.total} />

      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-surface px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)]">
        <div className="mx-auto max-w-[600px]">
          <Button full loading={pending} disabled={!addressId || quote.has_issues || quote.below_minimum} onClick={submit}>
            Place order · {formatMoney(quote.total)}
          </Button>
        </div>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Deliver to"
        footer={
          <Button
            variant="dark"
            full
            onClick={() => {
              setAddressId(pendingAddress);
              setNotes(addresses.find((a) => a.id === pendingAddress)?.delivery_instructions ?? '');
              setSheet(false);
            }}
          >
            Deliver here
          </Button>
        }
      >
        <div role="radiogroup" aria-label="Addresses" className="flex flex-col gap-3">
          {addresses.map((a) => {
            const Icon = LABEL_ICON[a.label];
            const on = pendingAddress === a.id;
            return (
              <button key={a.id} type="button" role="radio" aria-checked={on} onClick={() => setPendingAddress(a.id)} className={card(on)}>
                <span className={cx('grid size-12 shrink-0 place-items-center rounded-[14px]', on ? 'bg-brand text-on-brand' : 'bg-surface-muted')}>
                  <Icon size={22} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-card-title block capitalize">{a.label}</span>
                  <span className="t-caption block text-text-muted">{addressLine(a)}</span>
                </span>
                {radio(on)}
              </button>
            );
          })}
          <Link href="/addresses/new?next=/checkout" className="flex h-14 items-center justify-center gap-2 rounded-[24px] border-[1.5px] border-dashed border-disabled t-button-s">
            <Plus size={18} aria-hidden /> Add new address
          </Link>
        </div>
      </Sheet>
    </main>
  );
}
