import type { Metadata } from 'next';

import { AddressForm } from '@/components/address-form';
import { getProfile } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Add address' };

export default async function NewAddressPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { supabase, userId } = await requireUser();
  const profile = await getProfile(supabase, userId);
  return <AddressForm address={null} defaults={{ recipientName: profile?.display_name ?? '', phone: profile?.phone ?? '' }} next={next === '/checkout' ? '/checkout' : '/addresses'} />;
}
