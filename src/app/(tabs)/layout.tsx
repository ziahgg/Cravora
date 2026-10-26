import { AppNav } from '@/components/nav';
import { cartCount, viewer } from '@/lib/services/data';

/** Discovery and account tabs. Public pages stay public; the cart badge appears once signed in. */
export default async function TabsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { db, userId } = await viewer();
  const count = await cartCount(db, userId).catch(() => 0);
  return (
    <div className="min-h-dvh">
      {children}
      <AppNav cartCount={count} />
    </div>
  );
}
