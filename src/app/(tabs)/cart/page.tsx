import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CartView } from '@/components/cart-view';
import { quoteCart, viewer } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Cart' };

export default async function CartPage() {
  const { db, userId } = await viewer();
  if (!userId) redirect('/login?next=/cart');
  const quote = await quoteCart(db);
  return <CartView quote={quote} />;
}
