import { UserRound, UtensilsCrossed } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';

import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Welcome' };

/** Figma 00 Welcome (v3): photo, brand, headline, "Sign in" + "Browse without signing in". */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-bg md:my-8 md:min-h-0 md:overflow-hidden md:rounded-[32px]">
      <div className="relative h-[52dvh] min-h-[320px] md:h-[440px]">
        <Image src="/images/welcome.jpg" alt="A table of shared dishes: wings, nachos, salad and drinks" fill priority sizes="520px" className="object-cover" />
      </div>
      <section className="relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-bg px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="flex items-center gap-2.5 t-section">
          <span className="grid size-9 place-items-center rounded-full bg-brand text-on-brand">
            <UtensilsCrossed size={18} aria-hidden />
          </span>
          Cravora
        </p>
        <h1 className="mt-5 t-title-xl">Good food, right to your door.</h1>
        <p className="mt-3 t-body text-text-secondary">Order from local favorites, track every step, and reorder in one tap.</p>
        <div className="mt-auto flex flex-col gap-3 pt-10">
          <ButtonLink href="/login" icon={UserRound} full>
            Sign in
          </ButtonLink>
          <ButtonLink href="/" variant="secondary" full>
            Browse without signing in
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
