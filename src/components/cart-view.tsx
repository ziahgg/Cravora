'use client';

import { CircleAlert, Plus, ShoppingBag, Ticket, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { addToCart, setCartQuantity, setPromoCode } from '@/app/actions/shop';
import { formatMoney } from '@/lib/domain/money';
import type { CartQuote } from '@/types/database';
import { FoodImage } from './cards';
import { ConfirmDialog } from './overlays';
import { PriceBreakdown } from './price-breakdown';
import { QuantityControl } from './shop-controls';
import { useToast } from './toast';
import { ButtonLink, EmptyState, FieldMessage, cx } from './ui';

type Line = Extract<CartQuote, { restaurant: unknown }>['items'][number];

export function CartView({ quote }: { quote: CartQuote }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<Line | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  if (!('restaurant' in quote) || !quote.items.length)
    return (
      <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-32">
        <h1 className="t-title-xl">My cart</h1>
        <EmptyState icon={ShoppingBag} title="Your cart is empty" message="Find something tasty and it’ll show up here." action={<ButtonLink href="/" size="sm" className="mt-1">Browse restaurants</ButtonLink>} />
      </main>
    );

  const refresh = () => router.refresh();
  const setQty = (line: Line, quantity: number) =>
    start(async () => {
      const r = await setCartQuantity({ cartItemId: line.cart_item_id, quantity });
      if (!r.ok) toast({ kind: 'error', title: 'Couldn’t update the cart', message: r.error });
      refresh();
    });

  const remove = (line: Line) =>
    start(async () => {
      setRemoving(null);
      const r = await setCartQuantity({ cartItemId: line.cart_item_id, quantity: 0 });
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t remove', message: r.error });
      toast({
        icon: Trash2,
        title: 'Item removed',
        message: line.name,
        action: {
          label: 'Undo',
          onClick: () =>
            start(async () => {
              const u = await addToCart({ foodItemId: line.food_item_id, quantity: line.quantity, optionValueIds: line.option_ids, replace: false });
              if (!u.ok) toast({ kind: 'error', title: 'Couldn’t restore', message: u.error });
              refresh();
            }),
        },
      });
      refresh();
    });

  const applyCode = (value: string | null) =>
    start(async () => {
      const r = await setPromoCode({ code: value });
      if (!r.ok) return setCodeError(r.fields?.code ?? r.error);
      setCodeError(undefined);
      setCode('');
      refresh();
    });

  const blocked = quote.has_issues || quote.below_minimum;

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-56">
      <header className="flex items-baseline justify-between">
        <h1 className="t-title-xl">My cart</h1>
        <span className="t-body text-text-muted">
          {quote.count} item{quote.count === 1 ? '' : 's'}
        </span>
      </header>
      <div className="flex items-center gap-3 rounded-[24px] bg-surface p-3 pr-4">
        <FoodImage imageKey={quote.restaurant.image_key} alt="" sizes="56px" className="size-14 shrink-0 rounded-[14px]" />
        <div className="min-w-0 flex-1">
          <p className="t-card-title truncate">{quote.restaurant.name}</p>
          <p className="t-caption text-text-muted">
            Delivery in {quote.restaurant.eta_min}–{quote.restaurant.eta_max} min
          </p>
        </div>
        <Link href={`/restaurants/${quote.restaurant.slug}`} className="inline-flex items-center gap-1 t-label text-brand-ink">
          <Plus size={16} aria-hidden /> Add items
        </Link>
      </div>

      <ul className="flex flex-col gap-3" aria-busy={pending}>
        {quote.items.map((l) => (
          <li key={l.cart_item_id} className={cx('flex items-center gap-3 rounded-[24px] bg-surface p-3', l.issue && 'ring-[1.5px] ring-error')}>
            <FoodImage imageKey={l.image_key} alt={l.name} sizes="80px" className="size-20 shrink-0 rounded-[16px]" />
            <div className="min-w-0 flex-1">
              <p className="t-card-title truncate">{l.name}</p>
              <p className="t-caption truncate text-text-muted">{l.options.map((o) => (Number(o.price) > 0 ? `+ ${o.value}` : o.value)).join(' · ') || ' '}</p>
              {l.issue ? (
                <p className="flex items-center gap-1 t-caption text-error">
                  <CircleAlert size={14} aria-hidden /> {l.issue}
                </p>
              ) : (
                <p className="t-price-s num">{formatMoney(l.line_total)}</p>
              )}
            </div>
            {l.issue ? (
              <button type="button" onClick={() => remove(l)} className="h-10 rounded-full bg-error-soft px-4 t-button-s text-error">
                Remove
              </button>
            ) : (
              <QuantityControl value={l.quantity} min={0} label={`${l.name} quantity`} disabled={pending} onChange={(n) => (n === 0 ? setRemoving(l) : setQty(l, n))} />
            )}
          </li>
        ))}
      </ul>

      {quote.promo ? (
        <div className={cx('flex items-center gap-3 rounded-[24px] p-4', quote.promo.applied ? 'bg-brand-soft' : 'bg-warning-soft')}>
          <Ticket size={22} className={quote.promo.applied ? 'text-brand-ink' : 'text-warning'} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="t-card-title">{quote.promo.applied ? `${quote.promo.code} applied` : `${quote.promo.code} can’t be used`}</p>
            <p className="t-caption text-text-secondary">{quote.promo.message}</p>
          </div>
          <button type="button" onClick={() => applyCode(null)} className="t-label text-text-secondary">
            Remove
          </button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyCode(code);
          }}
        >
          <label htmlFor="promo" className="t-label text-text-secondary">
            Promo code
          </label>
          <div className="flex gap-2">
            <input id="promo" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" aria-invalid={!!codeError} aria-describedby="promo-msg" className="h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-4 t-item uppercase outline-none focus:border-ink" />
            <button type="submit" disabled={!code.trim() || pending} className="h-12 rounded-full bg-ink px-5 t-button-s text-on-ink disabled:opacity-40">
              Apply
            </button>
          </div>
          <FieldMessage id="promo-msg" error={codeError} />
        </form>
      )}

      <PriceBreakdown count={quote.count} subtotal={quote.subtotal} deliveryFee={quote.delivery_fee} freeDelivery={quote.free_delivery} serviceFee={quote.service_fee} discount={quote.discount} promoCode={quote.promo?.applied ? quote.promo.code : null} total={quote.total} />
      {quote.below_minimum ? <p className="rounded-[16px] bg-warning-soft p-3 t-body">Add {formatMoney(quote.restaurant.min_order - quote.subtotal)} more to reach the {formatMoney(quote.restaurant.min_order)} minimum.</p> : null}
      {quote.has_issues ? <p className="rounded-[16px] bg-error-soft p-3 t-body">Some items changed since you added them. Remove them to continue.</p> : null}

      <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 px-5">
        <div className="mx-auto max-w-[600px]">
          {blocked ? (
            <span className="flex h-14 items-center justify-center rounded-full bg-disabled t-button text-disabled-text">Checkout · {formatMoney(quote.total)}</span>
          ) : (
            <ButtonLink href="/checkout" full>
              Checkout · {formatMoney(quote.total)}
            </ButtonLink>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!removing}
        title="Remove this item?"
        message={removing ? `${removing.quantity}× ${removing.name} will be removed from your cart.` : ''}
        cancelLabel="Keep it"
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />
    </main>
  );
}
