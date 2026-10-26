import { Bike, Clock, Star, UtensilsCrossed } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatMoney } from '@/lib/domain/money';
import type { RestaurantCard as RestaurantCardData } from '@/lib/services/data';
import { cx } from './ui';

/** Photos exported from the Figma file (Unsplash). Anything else renders the neutral placeholder. */
const IMAGES = new Set(['double-smash', 'stack-smoke', 'classic-burger', 'chicken-sandwich', 'hot-wings', 'chicken-tenders', 'truffle-fries', 'tonkotsu', 'shrimp-ramen', 'margherita', 'green-bowl', 'tacos', 'donut', 'welcome']);

export function imageSrc(key: string | null | undefined): string | null {
  return key && IMAGES.has(key) ? `/images/${key}.jpg` : null;
}

/** Food photo with a neutral, clearly non-photographic fallback (no invented imagery). */
export function FoodImage({ imageKey, alt, sizes, className, priority, round }: { imageKey: string | null | undefined; alt: string; sizes: string; className?: string; priority?: boolean; round?: boolean }) {
  const src = imageSrc(imageKey);
  if (!src)
    return (
      <div className={cx('grid place-items-center bg-surface-muted text-text-muted', round && 'rounded-full', className)} role="img" aria-label={`${alt} (no photo yet)`}>
        <UtensilsCrossed size={28} aria-hidden />
      </div>
    );
  return (
    <div className={cx('relative overflow-hidden bg-surface-muted', round && 'rounded-full', className)}>
      <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}

export const priceLevel = (n: number) => '$'.repeat(Math.max(1, Math.min(3, n)));

export function Rating({ rating, count, compact }: { rating: number | null; count: number; compact?: boolean }) {
  if (rating === null || count === 0) return <span className="inline-flex h-7 items-center rounded-full bg-surface-muted px-2.5 t-caption-m text-text-secondary">New</span>;
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-muted px-2.5 t-label num" aria-label={`Rated ${rating} from ${count} review${count === 1 ? '' : 's'}`}>
      <Star size={14} className="fill-star text-star" aria-hidden />
      {rating.toFixed(1)}
      {compact ? null : <span className="t-caption text-text-muted">({count})</span>}
    </span>
  );
}

export function freeDeliveryActive(r: { free_delivery_until: string | null }, now: number): boolean {
  return !!r.free_delivery_until && Date.parse(r.free_delivery_until) > now;
}

export function DeliveryMeta({ r, now }: { r: Pick<RestaurantCardData, 'eta_min_minutes' | 'eta_max_minutes' | 'delivery_fee' | 'free_delivery_until'>; now: number }) {
  const free = freeDeliveryActive(r, now);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 t-body text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <Clock size={16} aria-hidden /> {r.eta_min_minutes}–{r.eta_max_minutes} min
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Bike size={16} aria-hidden /> {free ? 'Free delivery' : `${formatMoney(r.delivery_fee)} delivery`}
      </span>
    </div>
  );
}

/** Figma restaurant card: 7:3 cover, heart, optional "Free delivery" badge, name + rating, cuisine line, meta. */
export function RestaurantCard({ r, action, now, priority }: { r: RestaurantCardData; action?: ReactNode; now: number; priority?: boolean }) {
  const free = freeDeliveryActive(r, now);
  return (
    <article className="relative overflow-hidden rounded-[28px] bg-surface">
      <FoodImage imageKey={r.image_key} alt={r.name} sizes="(min-width: 768px) 360px, 100vw" className="aspect-[7/3] w-full" priority={priority} />
      {free ? <span className="absolute top-4 left-4 rounded-full bg-brand px-3 py-1 t-label text-on-brand">Free delivery</span> : null}
      {action ? <div className="absolute top-4 right-4 z-10">{action}</div> : null}
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="t-section truncate">
            <Link href={`/restaurants/${r.slug}`} className="after:absolute after:inset-0">
              {r.name}
            </Link>
          </h3>
          <Rating rating={r.rating} count={r.review_count} compact />
        </div>
        <p className="t-body text-text-muted">
          {r.cuisine}
          {r.tags[0] ? ` · ${r.tags[0][0].toUpperCase()}${r.tags[0].slice(1)}` : ''} · {priceLevel(r.price_level)}
        </p>
        <DeliveryMeta r={r} now={now} />
      </div>
    </article>
  );
}

/** Figma dish card: 4:3 photo, heart, name, sub-line, price and a lime "+" (or link to options). */
export function DishCard({ name, sub, price, imageKey, href, action, add }: { name: string; sub: string; price: number | string; imageKey: string | null; href: string; action?: ReactNode; add?: ReactNode }) {
  return (
    <article className="relative flex flex-col gap-2 rounded-[24px] bg-surface p-2.5 pb-3">
      <FoodImage imageKey={imageKey} alt={name} sizes="(min-width: 768px) 220px, 50vw" className="aspect-[4/3] w-full rounded-[18px]" />
      {action ? <div className="absolute top-4 right-4 z-10">{action}</div> : null}
      <div className="px-1.5">
        <h3 className="t-card-title truncate">
          <Link href={href} className="after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
        <p className="t-caption truncate text-text-muted">{sub}</p>
      </div>
      <div className="flex items-center justify-between px-1.5">
        <span className="t-price num">{formatMoney(price)}</span>
        <div className="relative z-10">{add}</div>
      </div>
    </article>
  );
}
