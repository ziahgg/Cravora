import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CheckoutForm } from '@/components/checkout-form';
import { getProfile, listAddresses, quoteCart, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const { db, userId } = await viewer();
  if (!userId) redirect('/login?next=/checkout');
  const [quote, addresses, profile] = await Promise.all([quoteCart(db), listAddresses(db, userId), getProfile(db, userId)]);
  if (!('restaurant' in quote) || !quote.items.length) redirect('/cart');
  return <CheckoutForm quote={quote} addresses={addresses} profileName={profile?.display_name ?? ''} />;
}
