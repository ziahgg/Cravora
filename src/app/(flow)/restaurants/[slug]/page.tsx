import { ArrowLeft, ArrowRight, Bike, Clock, ShoppingBag, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { DishCard, FoodImage, freeDeliveryActive, priceLevel } from '@/components/cards';
import { ShareButton } from '@/components/share-button';
import { FavoriteButton, QuickAdd } from '@/components/shop-controls';
import { formatMoney } from '@/lib/domain/money';
import { requestTime } from '@/lib/request-time';
import { favoriteIds, getRestaurant, quoteCart, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Restaurant' };

/** Figma 03 Restaurant details (+ 03b saved, 03c added to cart with the floating cart bar). */
export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) notFound();
  const { db, userId } = await viewer();
  const data = await getRestaurant(db, slug);
  if (!data) notFound();
  const { restaurant: r, categories, items } = data;
  const now = requestTime();
  const [favs, quote] = await Promise.all([favoriteIds(db, userId), userId ? quoteCart(db) : Promise.resolve(null)]);
  const popular = items.filter((i) => i.is_popular);
  const cartHere = quote && quote.count > 0 && 'restaurant' in quote && quote.restaurant.id === r.id ? quote : null;
  const free = freeDeliveryActive(r, now);

  const dishCard = (i: (typeof items)[number]) => (
    <DishCard
      name={i.name}
      sub={i.short_description}
      price={i.price}
      imageKey={i.image_key}
      href={`/dishes/${i.id}`}
      action={<FavoriteButton kind="dish" id={i.id} name={i.name} on={favs.items.has(i.id)} signedIn={!!userId} />}
      add={<QuickAdd foodItemId={i.id} name={i.name} price={formatMoney(i.price)} hasOptions={i.options.length > 0} href={`/dishes/${i.id}`} signedIn={!!userId} available={i.is_available && r.is_active} />}
    />
  );

  return (
    <main className={cartHere ? 'pb-32' : 'pb-12'}>
      <div className="relative mx-auto max-w-[760px]">
        <FoodImage imageKey={r.image_key} alt={r.name} sizes="(min-width: 768px) 760px, 100vw" className="h-[300px] w-full md:mt-6 md:rounded-[32px]" priority />
        <div className="absolute inset-x-5 top-[max(20px,env(safe-area-inset-top))] flex justify-between">
          <Link href="/" aria-label="Back" className="grid size-14 place-items-center rounded-full bg-white/95">
            <ArrowLeft size={22} aria-hidden />
          </Link>
          <div className="flex gap-3">
            <ShareButton text={`${r.name} on Cravora`} look="glass" />
            <FavoriteButton kind="restaurant" id={r.id} name={r.name} on={favs.restaurants.has(r.id)} signedIn={!!userId} size="lg" />
          </div>
        </div>
      </div>
      <div className="relative mx-auto -mt-8 flex max-w-[760px] flex-col gap-5 rounded-t-[32px] bg-bg px-5 pt-6 md:mt-4">
        <div className="flex items-center gap-4">
          <FoodImage imageKey={r.image_key} alt="" sizes="64px" className="size-16 shrink-0 rounded-[16px]" />
          <div className="min-w-0">
            <h1 className="t-title-xl">{r.name}</h1>
            <p className="t-body text-text-muted">
              {r.cuisine} · {priceLevel(r.price_level)} · {r.address}
            </p>
          </div>
        </div>
        {!r.is_active ? <p className="rounded-[16px] bg-warning-soft p-3 t-body">This restaurant isn’t taking orders right now.</p> : null}
        <dl className="grid grid-cols-4 rounded-[24px] bg-surface p-4 text-center">
          <div>
            <dt className="sr-only">Rating</dt>
            <dd className="flex items-center justify-center gap-1 t-section num">
              {r.rating !== null ? (
                <>
                  <Star size={16} className="fill-star text-star" aria-hidden /> {r.rating.toFixed(1)}
                </>
              ) : (
                'New'
              )}
            </dd>
            <dd className="t-caption text-text-muted">
              {r.review_count} review{r.review_count === 1 ? '' : 's'}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Delivery time</dt>
            <dd className="flex items-center justify-center gap-1 t-section num">
              <Clock size={16} aria-hidden /> {r.eta_min_minutes}–{r.eta_max_minutes}
            </dd>
            <dd className="t-caption text-text-muted">minutes</dd>
          </div>
          <div>
            <dt className="sr-only">Delivery fee</dt>
            <dd className="flex items-center justify-center gap-1 t-section num">
              <Bike size={16} aria-hidden /> {free ? 'Free' : formatMoney(r.delivery_fee)}
            </dd>
            <dd className="t-caption text-text-muted">delivery</dd>
          </div>
          <div>
            <dt className="sr-only">Minimum order</dt>
            <dd className="flex items-center justify-center gap-1 t-section num">
              <ShoppingBag size={16} aria-hidden /> {formatMoney(r.min_order).replace('.00', '')}
            </dd>
            <dd className="t-caption text-text-muted">minimum</dd>
          </div>
        </dl>

        <nav aria-label="Menu sections" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {popular.length ? (
            <a href="#popular" className="inline-flex h-10 shrink-0 items-center rounded-full bg-ink px-4 t-label text-on-ink">
              Popular
            </a>
          ) : null}
          {categories.map((c) => (
            <a key={c.id} href={`#${c.slug}`} className="inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-surface px-4 t-label">
              {c.name}
            </a>
          ))}
        </nav>

        {popular.length ? (
          <section id="popular" aria-labelledby="popular-h" className="flex scroll-mt-4 flex-col gap-3">
            <h2 id="popular-h" className="t-title">
              Popular
            </h2>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {popular.map((i) => (
                <li key={i.id}>{dishCard(i)}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {categories.map((c) => {
          const list = items.filter((i) => i.category_id === c.id);
          if (!list.length) return null;
          return (
            <section key={c.id} id={c.slug} aria-labelledby={`${c.slug}-h`} className="flex scroll-mt-4 flex-col gap-3">
              <h2 id={`${c.slug}-h`} className="t-title">
                {c.name}
              </h2>
              <ul className="flex flex-col gap-3">
                {list.map((i) => (
                  <li key={i.id} className="relative flex items-center gap-4 rounded-[24px] bg-surface p-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="t-card-title">
                        <Link href={`/dishes/${i.id}`} className="after:absolute after:inset-0">
                          {i.name}
                        </Link>
                      </h3>
                      <p className="t-body line-clamp-2 text-text-muted">{i.description}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="t-price-s num">{formatMoney(i.price)}</span>
                        {!i.is_available ? <span className="t-caption-m text-error">Sold out</span> : null}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <FoodImage imageKey={i.image_key} alt={i.name} sizes="96px" className="size-24 rounded-[18px]" />
                      <div className="absolute -right-1 -bottom-1 z-10">
                        <QuickAdd foodItemId={i.id} name={i.name} price={formatMoney(i.price)} hasOptions={i.options.length > 0} href={`/dishes/${i.id}`} signedIn={!!userId} available={i.is_available && r.is_active} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {cartHere ? (
        <div className="fixed inset-x-0 bottom-0 z-30 px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <Link href="/cart" className="mx-auto flex h-16 max-w-[560px] items-center gap-4 rounded-full bg-ink pr-2 pl-2 text-on-ink shadow-[var(--shadow-toast)]">
            <span className="grid size-12 place-items-center rounded-full bg-brand t-section text-on-brand num">{cartHere.count}</span>
            <span className="flex-1 t-button">View cart</span>
            <span className="t-price num">{formatMoney(cartHere.subtotal)}</span>
            <span className="grid size-12 place-items-center rounded-full bg-white text-ink">
              <ArrowRight size={20} aria-hidden />
            </span>
          </Link>
        </div>
      ) : null}
    </main>
  );
}
