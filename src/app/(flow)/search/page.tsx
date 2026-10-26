import { ChevronRight, Search, SearchX, X } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { DishCard, imageSrc, RestaurantCard } from '@/components/cards';
import { Screen } from '@/components/screen';
import { FavoriteButton, QuickAdd } from '@/components/shop-controls';
import { EmptyState, TopBar, cx } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { requestTime } from '@/lib/request-time';
import { cuisines, favoriteIds, listRestaurants, searchDishes, trendingDishes, viewer } from '@/lib/services/data';
import { searchSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Search' };

type Params = { q?: string; view?: string; fast?: string; top?: string; cuisine?: string };

/** Figma 02 Search, 02b/02d results (restaurants / dishes), 02c no results. Filters live in the URL. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = searchSchema.safeParse({ q: sp.q ?? '' }).data?.q ?? '';
  const view = sp.view === 'dishes' ? 'dishes' : 'restaurants';
  const fast = sp.fast === '1';
  const top = sp.top === '1';
  const cuisine = sp.cuisine?.slice(0, 40) || null;
  const browsing = !q && !cuisine && !fast && !top && !sp.view;
  const { db, userId } = await viewer();
  const now = requestTime();

  const href = (patch: Partial<Params>) => {
    const next = { q: q || undefined, view: view === 'dishes' ? 'dishes' : undefined, fast: fast ? '1' : undefined, top: top ? '1' : undefined, cuisine: cuisine ?? undefined, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    return `/search${s.size ? `?${s}` : ''}`;
  };

  const searchBox = (
    <form action="/search" role="search" className={cx('flex h-[60px] items-center gap-3 rounded-full bg-surface pr-2 pl-5', q && 'ring-[1.5px] ring-ink')}>
      <Search size={20} className="shrink-0 text-text-muted" aria-hidden />
      <label htmlFor="q" className="sr-only">
        Search dishes, restaurants or cuisines
      </label>
      <input id="q" name="q" type="search" defaultValue={q} autoFocus={browsing} placeholder="Dishes, restaurants or cuisines" className="h-full min-w-0 flex-1 bg-transparent t-item outline-none placeholder:text-text-muted" />
      {view === 'dishes' ? <input type="hidden" name="view" value="dishes" /> : null}
      {q ? (
        <Link href="/search" aria-label="Clear search" className="grid size-10 place-items-center rounded-full text-text-muted">
          <X size={18} aria-hidden />
        </Link>
      ) : null}
      <button type="submit" className="h-11 shrink-0 rounded-full bg-brand px-4 t-button-s text-on-brand">
        Search
      </button>
    </form>
  );

  if (browsing) {
    const [cs, trending] = await Promise.all([cuisines(db), trendingDishes(db, 3)]);
    return (
      <Screen>
        <TopBar title="Search" back="/" />
        {searchBox}
        <section aria-labelledby="cuisine-h" className="flex flex-col gap-3">
          <h2 id="cuisine-h" className="t-section">
            Browse by cuisine
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {cs.map((c) => (
              <li key={c.cuisine}>
                <Link href={href({ cuisine: c.cuisine })} className="flex items-center gap-3 rounded-[20px] bg-surface p-2.5">
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-[14px] bg-surface-muted">{imageSrc(c.image_key) ? <Image src={imageSrc(c.image_key)!} alt="" fill sizes="56px" className="object-cover" /> : null}</span>
                  <span className="t-item">{c.cuisine}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {trending.length ? (
          <section aria-labelledby="trend-h" className="flex flex-col gap-3">
            <h2 id="trend-h" className="t-section">
              Popular dishes
            </h2>
            <ol className="divide-y divide-divider overflow-hidden rounded-[24px] bg-surface">
              {trending.map((d, i) => (
                <li key={d.id}>
                  <Link href={`/dishes/${d.id}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-4 t-section text-brand-ink num">{i + 1}</span>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-[12px] bg-surface-muted">{imageSrc(d.image_key) ? <Image src={imageSrc(d.image_key)!} alt="" fill sizes="48px" className="object-cover" /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="t-item block truncate">{d.name}</span>
                      <span className="t-caption text-text-muted">
                        {d.restaurant.name} · {formatMoney(d.price)}
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
            <p className="t-caption text-text-muted">Picked by the restaurants — not personalised.</p>
          </section>
        ) : null}
      </Screen>
    );
  }

  const [restaurants, dishes, favs] = await Promise.all([
    listRestaurants(db, { q, cuisine, maxEta: fast ? 30 : null, minRating: top ? 4.5 : null }),
    searchDishes(db, q, { maxEta: fast ? 30 : null }),
    favoriteIds(db, userId),
  ]);
  const dishList = cuisine ? dishes.filter((d) => restaurants.some((r) => r.slug === d.restaurant.slug)) : top ? dishes.filter((d) => restaurants.some((r) => r.slug === d.restaurant.slug)) : dishes;
  const results = view === 'dishes' ? dishList.length : restaurants.length;

  return (
    <Screen>
      <TopBar title="Search" back="/search" />
      {searchBox}
      <div role="tablist" aria-label="Result type" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        {(['restaurants', 'dishes'] as const).map((v) => (
          <Link key={v} role="tab" aria-selected={view === v} href={href({ view: v === 'dishes' ? 'dishes' : undefined })} className={cx('grid h-12 place-items-center rounded-full t-button-s', view === v ? 'bg-ink text-on-ink' : 'text-text-secondary')}>
            {v === 'restaurants' ? `Restaurants · ${restaurants.length}` : `Dishes · ${dishList.length}`}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(
          [
            ['fast', fast, 'Under 30 min'],
            ['top', top, 'Rating 4.5+'],
          ] as const
        ).map(([k, on, label]) => (
          <Link key={k} href={href({ [k]: on ? undefined : '1' })} aria-pressed={on} className={cx('inline-flex h-10 items-center gap-1.5 rounded-full px-4 t-label', on ? 'bg-brand text-on-brand' : 'border border-border bg-surface')}>
            {label}
            {on ? <X size={14} aria-hidden /> : null}
          </Link>
        ))}
        {cuisine ? (
          <Link href={href({ cuisine: undefined })} className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 t-label text-on-brand">
            {cuisine} <X size={14} aria-hidden />
          </Link>
        ) : null}
        {fast || top || cuisine ? (
          <Link href={href({ fast: undefined, top: undefined, cuisine: undefined })} className="px-2 t-label text-text-secondary">
            Clear all
          </Link>
        ) : null}
      </div>

      {!results ? (
        <EmptyState icon={SearchX} title={q ? `No results for “${q}”` : 'No matches'} message="Try a different dish or cuisine, or remove a filter." action={<Link href="/search" className="t-body-m underline underline-offset-4">Start over</Link>} />
      ) : view === 'restaurants' ? (
        <>
          <p className="t-caption text-text-muted">
            {restaurants.length} restaurant{restaurants.length === 1 ? '' : 's'} · sorted by rating
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {restaurants.map((r) => (
              <li key={r.id}>
                <RestaurantCard r={r} now={now} action={<FavoriteButton kind="restaurant" id={r.id} name={r.name} on={favs.restaurants.has(r.id)} signedIn={!!userId} />} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {dishList.map((d) => (
            <li key={d.id}>
              <DishCard
                name={d.name}
                sub={`${d.restaurant.name.split(' ')[0]} · ${d.restaurant.eta_min_minutes}–${d.restaurant.eta_max_minutes} min`}
                price={d.price}
                imageKey={d.image_key}
                href={`/dishes/${d.id}`}
                action={<FavoriteButton kind="dish" id={d.id} name={d.name} on={favs.items.has(d.id)} signedIn={!!userId} />}
                add={<QuickAdd foodItemId={d.id} name={d.name} price={formatMoney(d.price)} hasOptions={d.has_options} href={`/dishes/${d.id}`} signedIn={!!userId} available={d.is_available} />}
              />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
