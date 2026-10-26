import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AddressForm } from '@/components/address-form';
import { listAddresses } from '@/lib/services/data';
import { requireUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit address' };

export default async function EditAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const address = (await listAddresses(supabase, userId)).find((a) => a.id === id);
  if (!address) notFound();
  return <AddressForm address={address} defaults={{ recipientName: address.recipient_name, phone: address.phone }} next="/addresses" />;
}
