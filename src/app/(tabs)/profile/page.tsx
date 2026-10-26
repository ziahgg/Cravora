import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProfileView } from '@/components/profile-view';
import { Screen } from '@/components/screen';
import { getProfile, isRestaurantOwner, listAddresses, listOrders, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Profile' };

/** Figma 12 Profile & settings. */
export default async function ProfilePage() {
  const { db, userId } = await viewer();
  if (!userId) redirect('/login?next=/profile');
  const [profile, addresses, orders, owner] = await Promise.all([getProfile(db, userId), listAddresses(db, userId), listOrders(db, userId, 200), isRestaurantOwner(db, userId)]);
  if (!profile) redirect('/auth/signout');
  return (
    <Screen>
      <h1 className="t-title-xl">Profile</h1>
      <ProfileView profile={profile} orderCount={orders.length} addressCount={addresses.length} isOwner={owner} />
    </Screen>
  );
}
