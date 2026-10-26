import { Heart } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DishCard, RestaurantCard } from '@/components/cards';
import { Screen } from '@/components/screen';
import { FavoriteButton, QuickAdd } from '@/components/shop-controls';
import { ButtonLink, EmptyState, cx } from '@/components/ui';
import { formatMoney } from '@/lib/domain/money';
import { requestTime } from '@/lib/request-time';
import { favoriteIds, listRestaurants, searchDishes, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Favorites' };

/** Figma 11 Favorites — restaurants / 11b dishes. */
export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const { db, userId } = await viewer();
  if (!userId) redirect('/login?next=/favorites');
  const favs = await favoriteIds(db, userId);
  const [restaurants, dishes] = await Promise.all([listRestaurants(db, { ids: [...favs.restaurants] }), searchDishes(db, '', { ids: [...favs.items] })]);
  const showDishes = tab === 'dishes';
  const now = requestTime();
  return (
    <Screen>
      <h1 className="t-title-xl">Favorites</h1>
      <div role="tablist" aria-label="Favorites" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
        <Link role="tab" aria-selected={!showDishes} href="/favorites" className={cx('grid h-12 place-items-center rounded-full t-button-s', !showDishes ? 'bg-ink text-on-ink' : 'text-text-secondary')}>
          Restaurants · {restaurants.length}
        </Link>
        <Link role="tab" aria-selected={showDishes} href="/favorites?tab=dishes" className={cx('grid h-12 place-items-center rounded-full t-button-s', showDishes ? 'bg-ink text-on-ink' : 'text-text-secondary')}>
          Dishes · {dishes.length}
        </Link>
      </div>
      {showDishes ? (
        dishes.length ? (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {dishes.map((d) => (
              <li key={d.id}>
                <DishCard name={d.name} sub={d.restaurant.name} price={d.price} imageKey={d.image_key} href={`/dishes/${d.id}`} action={<FavoriteButton kind="dish" id={d.id} name={d.name} on signedIn />} add={<QuickAdd foodItemId={d.id} name={d.name} price={formatMoney(d.price)} hasOptions={d.has_options} href={`/dishes/${d.id}`} signedIn available={d.is_available} />} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Heart} title="No favorite dishes yet" message="Tap the heart on a dish to save it here." action={<ButtonLink href="/search?view=dishes" size="sm">Find dishes</ButtonLink>} />
        )
      ) : restaurants.length ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {restaurants.map((r) => (
            <li key={r.id}>
              <RestaurantCard r={r} now={now} action={<FavoriteButton kind="restaurant" id={r.id} name={r.name} on signedIn />} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Heart} title="No favorite restaurants yet" message="Tap the heart on a restaurant to save it here." action={<ButtonLink href="/" size="sm">Browse restaurants</ButtonLink>} />
      )}
    </Screen>
  );
}
