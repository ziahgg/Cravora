'use client';

import { CircleCheck, Heart, Minus, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';

import { addToCart, setFavorite } from '@/app/actions/shop';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { cx } from './ui';

/** Heart toggle (red is reserved for favorites). Signed-out visitors are sent to sign in. */
export function FavoriteButton({ kind, id, name, on, signedIn, size = 'md' }: { kind: 'restaurant' | 'dish'; id: string; name: string; on: boolean; signedIn: boolean; size?: 'md' | 'lg' }) {
  const [fav, setFav] = useOptimistic(on);
  const [, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const path = usePathname();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? `Remove ${name} from favorites` : `Save ${name} to favorites`}
      onClick={() => {
        if (!signedIn) return router.push(`/login?next=${encodeURIComponent(path)}`);
        start(async () => {
          setFav(!fav);
          const r = await setFavorite(kind, id, !fav);
          if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t update favorites', message: r.error });
          toast({ icon: Heart, title: fav ? 'Removed from favorites' : 'Saved to favorites', message: name });
          router.refresh();
        });
      }}
      className={cx('grid shrink-0 place-items-center rounded-full bg-white/95 text-text shadow-sm', size === 'lg' ? 'size-14 border border-border' : 'size-11')}
    >
      <Heart size={size === 'lg' ? 22 : 20} className={cx(fav && 'fill-heart text-heart')} aria-hidden />
    </button>
  );
}

/** Figma stepper: − n + in a pill, lime plus. */
export function QuantityControl({ value, onChange, min = 1, max = 20, label, disabled }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; disabled?: boolean }) {
  return (
    <div className="inline-flex h-12 items-center gap-1 rounded-full bg-surface-muted p-1" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} className="grid size-10 place-items-center rounded-full bg-surface disabled:opacity-40">
        <Minus size={18} aria-hidden />
      </button>
      <output className="w-8 text-center t-section num" aria-live="polite">
        {value}
      </output>
      <button type="button" aria-label={`Increase ${label}`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40">
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Adds a dish to the cart through the server (which validates options and prices). One restaurant
 * per cart: on conflict the user chooses to start a new cart — nothing is discarded silently.
 */
export function useAddToCart(signedIn: boolean) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [conflict, setConflict] = useState<{ current: string; retry: () => void } | null>(null);

  const add = (args: { foodItemId: string; name: string; quantity: number; optionValueIds: string[]; totalLabel: string }, replace = false): Promise<boolean> =>
    new Promise((resolve) => {
      if (!signedIn) {
        router.push(`/login?next=${encodeURIComponent(path)}`);
        return resolve(false);
      }
      start(async () => {
        const r = await addToCart({ foodItemId: args.foodItemId, quantity: args.quantity, optionValueIds: args.optionValueIds, replace });
        if (!r.ok) {
          toast({ kind: 'error', title: 'Couldn’t add to cart', message: r.error });
          return resolve(false);
        }
        if (r.data.status === 'conflict') {
          setConflict({ current: r.data.currentRestaurant ?? 'another restaurant', retry: () => void add(args, true).then(resolve) });
          return;
        }
        toast({ icon: CircleCheck, title: 'Added to cart', message: `${args.quantity}× ${args.name} · ${args.totalLabel}`, action: { label: 'View cart', onClick: () => router.push('/cart') } });
        router.refresh();
        resolve(true);
      });
    });

  const dialog = (
    <ConfirmDialog
      open={!!conflict}
      title="Start a new cart?"
      message={`Your cart has food from ${conflict?.current}. Orders come from one restaurant at a time — starting a new cart removes those items.`}
      cancelLabel="Keep current cart"
      confirmLabel="Start new cart"
      onCancel={() => setConflict(null)}
      onConfirm={() => {
        const c = conflict;
        setConflict(null);
        c?.retry();
      }}
    />
  );
  return { add, pending, dialog };
}

/** Lime "+" on dish cards: adds directly when the dish has no options, otherwise opens details. */
export function QuickAdd({ foodItemId, name, price, hasOptions, href, signedIn, available }: { foodItemId: string; name: string; price: string; hasOptions: boolean; href: string; signedIn: boolean; available: boolean }) {
  const router = useRouter();
  const { add, pending, dialog } = useAddToCart(signedIn);
  if (!available) return <span className="t-caption-m text-text-muted">Sold out</span>;
  return (
    <>
      <button
        type="button"
        aria-label={hasOptions ? `Choose options for ${name}` : `Add ${name} to cart`}
        disabled={pending}
        onClick={() => (hasOptions ? router.push(href) : void add({ foodItemId, name, quantity: 1, optionValueIds: [], totalLabel: price }))}
        className="grid size-10 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-60"
      >
        <Plus size={20} aria-hidden />
      </button>
      {dialog}
    </>
  );
}
