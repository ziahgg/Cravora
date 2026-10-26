'use client';

import { ArrowLeft, CircleAlert, Store } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { defaultSelection, selectionErrors, toggleValue, unitPriceCents, type OptionGroup } from '@/lib/domain/menu';
import { formatCents, formatMoney, toCents } from '@/lib/domain/money';
import type { MenuItem } from '@/lib/services/data';
import { FoodImage } from './cards';
import { FavoriteButton, QuantityControl, useAddToCart } from './shop-controls';
import { Button, cx } from './ui';

/** Figma 04 Dish details / 04b required option. Prices shown here are a preview; the server re-prices. */
export function DishForm({ item, restaurant, favorite, signedIn }: { item: MenuItem; restaurant: { id: string; name: string; slug: string; is_active: boolean }; favorite: boolean; signedIn: boolean }) {
  const router = useRouter();
  const groups: OptionGroup[] = item.options;
  const [selected, setSelected] = useState<string[]>(() => defaultSelection(groups));
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const { add, pending, dialog } = useAddToCart(signedIn);
  const errors = selectionErrors(groups, selected);
  const firstError = groups.find((g) => errors[g.id]);
  const total = unitPriceCents(item.price, groups, selected) * qty;
  const available = item.is_available && restaurant.is_active;

  const submit = async () => {
    if (firstError) {
      setShowErrors(true);
      groupRefs.current[firstError.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const ok = await add({ foodItemId: item.id, name: item.name, quantity: qty, optionValueIds: selected, totalLabel: formatCents(total) });
    if (ok) router.push(`/restaurants/${restaurant.slug}`);
  };

  const nutrition = [
    [item.calories, 'kcal'],
    [item.protein_g, 'protein', 'g'],
    [item.fat_g, 'fat', 'g'],
    [item.carbs_g, 'carbs', 'g'],
  ] as const;

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-5 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <header className="flex h-14 items-center justify-between">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="grid size-14 place-items-center rounded-full border border-border bg-surface">
          <ArrowLeft size={22} aria-hidden />
        </button>
        <h1 className="sr-only">{item.name}</h1>
        <span className="t-title" aria-hidden>
          Details
        </span>
        <FavoriteButton kind="dish" id={item.id} name={item.name} on={favorite} signedIn={signedIn} size="lg" />
      </header>

      {showErrors && firstError ? (
        <div role="alert" className="flex items-center gap-3 rounded-[20px] bg-ink p-3 pr-4 text-on-ink">
          <span className="grid size-10 place-items-center rounded-full bg-error">
            <CircleAlert size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-item block">One more choice needed</span>
            <span className="t-caption text-white/70">{errors[firstError.id]}</span>
          </span>
          <button type="button" className="t-button-s text-brand" onClick={() => groupRefs.current[firstError.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            Go
          </button>
        </div>
      ) : null}

      <div className="grid place-items-center rounded-[28px] bg-gradient-to-br from-surface-muted to-brand-soft p-5">
        <FoodImage imageKey={item.image_key} alt={item.name} sizes="240px" round priority className="size-[230px]" />
      </div>
      <div>
        <p className="t-title-xl">{item.name}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Link href={`/restaurants/${restaurant.slug}`} className="inline-flex items-center gap-2 t-body text-text-secondary">
            <Store size={18} aria-hidden /> {restaurant.name}
          </Link>
          <span className="t-price-l num">{formatMoney(item.price)}</span>
        </div>
      </div>
      {nutrition.some(([v]) => v !== null) ? (
        <dl className="grid grid-cols-4 divide-x divide-divider rounded-[20px] bg-surface py-3 text-center">
          {nutrition.map(([v, label, unit]) => (
            <div key={label}>
              <dd className="t-section num">{v === null ? '—' : `${v}${unit ? ` ${unit}` : ''}`}</dd>
              <dt className="t-caption text-text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
      {item.description ? <p className="t-body text-text-secondary">{item.description}</p> : null}

      {groups.map((g) => {
        const err = showErrors ? errors[g.id] : undefined;
        return (
          <fieldset
            key={g.id}
            ref={(el) => {
              groupRefs.current[g.id] = el;
            }}
            className={cx('rounded-[24px] bg-surface p-4', err && 'ring-[1.5px] ring-error')}
            aria-describedby={err ? `${g.id}-err` : undefined}
          >
            <legend className="sr-only">{g.name}</legend>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="t-section">{g.name}</p>
                <p className="t-caption text-text-muted">{g.selection_type === 'single' ? 'Pick 1' : g.min_selections ? `Pick ${g.min_selections}–${g.max_selections}` : `Up to ${g.max_selections}`}</p>
              </div>
              <span className={cx('rounded-full px-2.5 py-1 t-caption-m', g.is_required ? (err ? 'bg-error-soft text-error' : 'bg-ink text-on-ink') : 'bg-surface-muted text-text-secondary')}>{g.is_required ? 'Required' : 'Optional'}</span>
            </div>
            {err ? (
              <p id={`${g.id}-err`} className="mb-1 t-caption text-error">
                {err}
              </p>
            ) : null}
            <ul className="divide-y divide-divider">
              {g.values.map((v) => {
                const on = selected.includes(v.id);
                const price = toCents(v.additional_price);
                return (
                  <li key={v.id}>
                    <label className={cx('flex min-h-14 cursor-pointer items-center gap-3', !v.is_available && 'cursor-not-allowed opacity-50')}>
                      <input
                        type={g.selection_type === 'single' ? 'radio' : 'checkbox'}
                        name={g.id}
                        checked={on}
                        disabled={!v.is_available}
                        onChange={() => setSelected((s) => toggleValue(groups, s, v.id))}
                        className={cx('size-6 shrink-0 accent-[#141414]', g.selection_type === 'single' ? 'rounded-full' : 'rounded-md')}
                      />
                      <span className="flex-1 t-item">{v.name}</span>
                      <span className="t-body text-text-muted">{!v.is_available ? 'Sold out' : price ? `+${formatCents(price)}` : 'Included'}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-surface px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)]">
        <div className="mx-auto flex max-w-[600px] items-center gap-3">
          <QuantityControl value={qty} onChange={setQty} label="quantity" />
          <Button full loading={pending} disabled={!available || (showErrors && !!firstError)} onClick={submit} className="whitespace-nowrap px-4">
            {available ? `Add to cart · ${formatCents(total)}` : 'Sold out'}
          </Button>
        </div>
      </div>
      {dialog}
    </main>
  );
}
