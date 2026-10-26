'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { deleteAddress, saveAddress } from '@/app/actions/shop';
import type { AddressLabel, AddressRow } from '@/types/database';
import { ConfirmDialog, Toggle } from './overlays';
import { useToast } from './toast';
import { Button, Field, FormError, IconButton, TopBar, cx } from './ui';

/** Figma 12c Add address. No map pin or geolocation: the address is typed, not tracked. */
export function AddressForm({ address, defaults, next }: { address: AddressRow | null; defaults: { recipientName: string; phone: string }; next: string }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    label: (address?.label ?? 'home') as AddressLabel,
    recipientName: address?.recipient_name ?? defaults.recipientName,
    phone: address?.phone ?? defaults.phone,
    addressLine: address?.address_line ?? '',
    unit: address?.unit ?? '',
    city: address?.city ?? '',
    postalCode: address?.postal_code ?? '',
    deliveryInstructions: address?.delivery_instructions ?? '',
    isDefault: address?.is_default ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const save = () =>
    start(async () => {
      const r = await saveAddress({ id: address?.id ?? null, ...v });
      if (!r.ok) {
        setErrors(r.fields ?? {});
        setFormError(r.error);
        return;
      }
      toast({ title: address ? 'Address updated' : 'Address saved', message: v.addressLine });
      router.replace(next);
      router.refresh();
    });

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-36">
      <TopBar title={address ? 'Edit address' : 'Add address'} close={next} right={address ? <IconButton icon={Trash2} label="Delete address" onClick={() => setConfirm(true)} /> : undefined} />
      <FormError message={formError} />
      <Field id={`${id}-l`} label="Street address *" value={v.addressLine} onChange={set('addressLine')} error={errors.addressLine} autoComplete="address-line1" />
      <Field id={`${id}-u`} label="Apt, suite, floor" value={v.unit} onChange={set('unit')} error={errors.unit} autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-c`} label="City *" value={v.city} onChange={set('city')} error={errors.city} autoComplete="address-level2" />
        <Field id={`${id}-z`} label="ZIP *" value={v.postalCode} onChange={set('postalCode')} error={errors.postalCode} autoComplete="postal-code" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-n`} label="Recipient *" value={v.recipientName} onChange={set('recipientName')} error={errors.recipientName} autoComplete="name" />
        <Field id={`${id}-p`} label="Phone *" type="tel" value={v.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-lab`} className="t-label text-text-secondary">
          Label
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-lab`} className="flex gap-2">
          {(['home', 'work', 'other'] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={v.label === l} onClick={() => setV({ ...v, label: l })} className={cx('h-11 rounded-full px-5 t-button-s capitalize', v.label === l ? 'bg-ink text-on-ink' : 'border border-border bg-surface')}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <Field id={`${id}-i`} label="Delivery instructions" placeholder="e.g. Gate code 2210, leave with concierge" value={v.deliveryInstructions} onChange={set('deliveryInstructions')} error={errors.deliveryInstructions} />
      <div className="flex items-center justify-between rounded-[20px] bg-surface p-4">
        <span className="t-item">Use as default address</span>
        <Toggle checked={v.isDefault} onChange={(b) => setV({ ...v, isDefault: b })} label="Use as default address" />
      </div>
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-bg from-70% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[520px]">
          <Button full loading={pending} onClick={save}>
            Save address
          </Button>
        </div>
      </div>
      {address ? (
        <ConfirmDialog
          open={confirm}
          title="Delete this address?"
          message="Past orders keep their own copy of the address."
          cancelLabel="Keep it"
          confirmLabel="Delete"
          danger
          loading={pending}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            start(async () => {
              const r = await deleteAddress(address.id);
              if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t delete', message: r.error });
              toast({ title: 'Address deleted' });
              router.replace('/addresses');
              router.refresh();
            })
          }
        />
      ) : null}
    </main>
  );
}
