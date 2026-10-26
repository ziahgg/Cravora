import { Bell, ChevronDown, ChevronRight, MapPin, Search, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { freeDeliveryActive, imageSrc, RestaurantCard } from '@/components/cards';
import { Screen } from '@/components/screen';
import { FavoriteButton } from '@/components/shop-controls';
import { EmptyState, IconButton, SectionHeader, cx } from '@/components/ui';
import { requestTime } from '@/lib/request-time';
import { favoriteIds, listAddresses, listRestaurants, unreadCount, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Home' };

const TAGS: { tag: string; label: string }[] = [
  { tag: 'burger', label: 'Burger' },
  { tag: 'ramen', label: 'Ramen' },
  { tag: 'pizza', label: 'Pizza' },
  { tag: 'bowls', label: 'Bowls' },
  { tag: 'tacos', label: 'Tacos' },
  { tag: 'desserts', label: 'Desserts' },
];

/** Figma 01 Home: deliver-to, promo banner, cuisine chips, restaurant list. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ tag?: string }> }) {
  const { tag: rawTag } = await searchParams;
  const tag = TAGS.some((t) => t.tag === rawTag) ? rawTag! : null;
  const { db, userId } = await viewer();
  const now = requestTime();
  const [all, favs, addresses, unread] = await Promise.all([listRestaurants(db), favoriteIds(db, userId), userId ? listAddresses(db, userId) : Promise.resolve([]), unreadCount(db, userId)]);
  const list = tag ? all.filter((r) => r.tags.includes(tag)) : all;
  const promo = all.find((r) => freeDeliveryActive(r, now));
  const address = addresses[0];
  const tagImage = (t: string) => all.find((r) => r.tags.includes(t))?.image_key ?? null;

  return (
    <Screen>
      <header className="flex items-center justify-between gap-3">
        <IconButton icon={Search} label="Search" href="/search" className="size-14" />
        <Link href={userId ? '/addresses' : '/login?next=/'} className="flex min-w-0 flex-col items-center">
          <span className="t-caption text-text-muted">Deliver to</span>
          <span className="flex min-w-0 items-center gap-1.5 t-card-title">
            <MapPin size={16} className="shrink-0 text-brand-ink" aria-hidden />
            <span className="truncate">{address ? `${address.address_line}, ${address.city}` : userId ? 'Add an address' : 'Sign in to set address'}</span>
            <ChevronDown size={16} className="shrink-0" aria-hidden />
          </span>
        </Link>
        <span className="relative">
          <IconButton icon={Bell} label={unread ? `Notifications, ${unread} unread` : 'Notifications'} href={userId ? '/notifications' : '/login?next=/notifications'} className="size-14" />
          {unread ? <span className="absolute top-3 right-3.5 size-2.5 rounded-full bg-heart ring-2 ring-surface" aria-hidden /> : null}
        </span>
      </header>

      {promo ? (
        <section aria-label="Offer" className="relative flex min-h-[160px] items-center overflow-hidden rounded-[28px] bg-ink p-5 text-on-ink">
          <div className="relative z-10 max-w-[60%]">
            <h2 className="t-title-l">Free delivery at {promo.name}</h2>
            <p className="mt-1 t-body text-white/70">
              Until {new Date(promo.free_delivery_until ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · no code needed
            </p>
            <Link href={`/restaurants/${promo.slug}`} className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-5 t-button-s text-on-brand">
              Order now
            </Link>
          </div>
          {imageSrc(promo.image_key) ? (
            <div className="absolute top-1/2 right-[-40px] size-[190px] -translate-y-1/2 overflow-hidden rounded-full">
              <Image src={imageSrc(promo.image_key)!} alt="" fill sizes="190px" className="object-cover" />
            </div>
          ) : null}
        </section>
      ) : null}

      <nav aria-label="Food types" className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
        {TAGS.map((t) => {
          const on = tag === t.tag;
          const img = imageSrc(tagImage(t.tag));
          return (
            <Link
              key={t.tag}
              href={on ? '/' : `/?tag=${t.tag}`}
              aria-current={on ? 'true' : undefined}
              scroll={false}
              className={cx('flex w-[92px] shrink-0 flex-col items-center gap-2 rounded-[24px] px-2 py-3', on ? 'bg-ink text-on-ink' : 'bg-surface')}
            >
              <span className="relative size-14 overflow-hidden rounded-full bg-surface-muted">{img ? <Image src={img} alt="" fill sizes="56px" className="object-cover" /> : null}</span>
              <span className="t-label">{t.label}</span>
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="popular-h" className="flex flex-col gap-3">
        <SectionHeader id="popular-h" title={tag ? `${TAGS.find((t) => t.tag === tag)?.label} spots` : 'Popular on Cravora'} href="/search?view=restaurants" />
        {list.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((r, i) => (
              <li key={r.id}>
                <RestaurantCard r={r} now={now} priority={i === 0} action={<FavoriteButton kind="restaurant" id={r.id} name={r.name} on={favs.restaurants.has(r.id)} signedIn={!!userId} />} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={SearchX} title="Nothing here yet" message="No restaurants serve this right now." action={<Link href="/" className="t-body-m underline underline-offset-4">Show all</Link>} />
        )}
        <Link href="/search" className="inline-flex items-center gap-1 self-center t-body text-text-secondary">
          Search dishes and cuisines <ChevronRight size={16} aria-hidden />
        </Link>
      </section>
    </Screen>
  );
}
