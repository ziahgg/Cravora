import { Briefcase, House, MapPin, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Screen } from '@/components/screen';
import { EmptyState, Tag, TopBar } from '@/components/ui';
import { listAddresses } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Saved addresses' };
const ICON = { home: House, work: Briefcase, other: MapPin };

/** Figma 12b Saved addresses. */
export default async function AddressesPage() {
  const { supabase, userId } = await requireUser();
  const addresses = await listAddresses(supabase, userId);
  return (
    <Screen>
      <TopBar title="Saved addresses" back="/profile" />
      {addresses.length ? (
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => {
            const Icon = ICON[a.label];
            return (
              <li key={a.id}>
                <Link href={`/addresses/${a.id}`} className="flex items-center gap-4 rounded-[24px] bg-surface p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-surface-muted">
                    <Icon size={22} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 t-card-title capitalize">
                      {a.label} {a.is_default ? <Tag tone="brand">Default</Tag> : null}
                    </span>
                    <span className="t-caption block text-text-muted">
                      {a.address_line}
                      {a.unit ? `, ${a.unit}` : ''}, {a.city} {a.postal_code}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={MapPin} title="No saved addresses" message="Add where you’d like your food delivered." />
      )}
      <Link href="/addresses/new" className="flex h-14 items-center justify-center gap-2 rounded-[24px] border-[1.5px] border-dashed border-disabled t-button-s">
        <Plus size={18} aria-hidden /> Add new address
      </Link>
    </Screen>
  );
}
