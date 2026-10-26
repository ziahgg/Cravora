'use client';

import { Heart, House, ReceiptText, ShoppingBag, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cx } from './ui';

const TABS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Home', icon: House, match: (p) => p === '/' || p.startsWith('/search') || p.startsWith('/restaurants') || p.startsWith('/dishes') },
  { href: '/favorites', label: 'Favorites', icon: Heart, match: (p) => p.startsWith('/favorites') },
  { href: '/orders', label: 'Orders', icon: ReceiptText, match: (p) => p.startsWith('/orders') },
  { href: '/cart', label: 'Cart', icon: ShoppingBag, match: (p) => p.startsWith('/cart') },
  { href: '/profile', label: 'Profile', icon: UserRound, match: (p) => p.startsWith('/profile') || p.startsWith('/addresses') || p.startsWith('/payment-methods') || p.startsWith('/help') || p.startsWith('/restaurant') },
];

/** Figma bottom bar: five labelled tabs; the active one sits in a lime pill; the cart shows its item count. */
export function AppNav({ cartCount }: { cartCount: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 rounded-t-[28px] bg-surface pb-[max(10px,env(safe-area-inset-bottom))] shadow-[var(--shadow-nav)]">
      <ul className="mx-auto flex max-w-[560px] justify-between px-3 pt-3">
        {TABS.map((t) => {
          const on = t.match(path);
          const badge = t.href === '/cart' && cartCount > 0;
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={on ? 'page' : undefined} aria-label={badge ? `${t.label}, ${cartCount} items` : t.label} className="flex flex-col items-center gap-1">
                <span className={cx('relative grid h-9 w-14 place-items-center rounded-full transition-colors', on ? 'bg-brand text-on-brand' : 'text-text-muted hover:text-text-secondary')}>
                  <t.icon size={22} strokeWidth={on ? 2 : 1.75} aria-hidden />
                  {badge ? <span className="absolute -top-1 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 t-caption-m text-white num">{cartCount > 99 ? '99+' : cartCount}</span> : null}
                </span>
                <span className={cx('t-nav', on ? 't-caption-m text-text' : 'text-text-muted')}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
