import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DishForm } from '@/components/dish-form';
import { favoriteIds, getDish, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Dish' };

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, userId } = await viewer();
  const data = await getDish(db, id);
  if (!data) notFound();
  const favs = await favoriteIds(db, userId);
  return <DishForm item={data.item} restaurant={{ id: data.restaurant.id, name: data.restaurant.name, slug: data.restaurant.slug, is_active: data.restaurant.is_active }} favorite={favs.items.has(id)} signedIn={!!userId} />;
}
