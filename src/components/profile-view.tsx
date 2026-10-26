'use client';

import { Bell, CircleHelp, CreditCard, Globe, LogOut, MapPin, Pencil, Percent, ReceiptText, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { signOut } from '@/app/actions/auth';
import { updatePreference, updateProfile } from '@/app/actions/shop';
import type { ProfileRow } from '@/types/database';
import { ConfirmDialog, Sheet, Toggle } from './overlays';
import { useToast } from './toast';
import { Button, Card, Field, IconButton, ListRow } from './ui';

export function ProfileView({ profile, orderCount, addressCount, isOwner }: { profile: ProfileRow; orderCount: number; addressCount: number; isOwner: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [form, setForm] = useState({ displayName: profile.display_name, phone: profile.phone ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefs, setPrefs] = useState({ order_updates: profile.order_updates, promo_offers: profile.promo_offers });
  const initials = profile.display_name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'C';

  const toggle = (key: 'order_updates' | 'promo_offers', v: boolean) => {
    setPrefs((p) => ({ ...p, [key]: v }));
    start(async () => {
      const r = await updatePreference(key, v);
      if (!r.ok) {
        setPrefs((p) => ({ ...p, [key]: !v }));
        toast({ kind: 'error', title: 'Couldn’t save', message: r.error });
      }
    });
  };

  const group = (title: string, children: React.ReactNode) => (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="t-body text-text-secondary">{title}</h2>
      <Card className="divide-y divide-divider overflow-hidden">{children}</Card>
    </section>
  );

  return (
    <>
      <Card className="flex items-center gap-4 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand t-title text-on-brand" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-section truncate">{profile.display_name || 'Your name'}</p>
          <p className="t-body text-text-muted">{profile.phone ?? 'Add a phone number'}</p>
        </div>
        <IconButton icon={Pencil} label="Edit profile" look="muted" size="md" onClick={() => (setErrors({}), setEdit(true))} />
      </Card>

      {group(
        'Orders & delivery',
        <>
          <ListRow icon={ReceiptText} label="Order history" value={String(orderCount)} href="/orders" />
          <ListRow icon={MapPin} label="Saved addresses" value={String(addressCount)} href="/addresses" />
          <ListRow icon={CreditCard} label="Payment methods" value="Cash · Demo card" href="/payment-methods" />
        </>,
      )}
      {group(
        'Preferences',
        <>
          <ListRow icon={Bell} label="Order updates" trailing={<Toggle checked={prefs.order_updates} onChange={(v) => toggle('order_updates', v)} label="Order updates" />} />
          <ListRow icon={Percent} label="Offers & promos" trailing={<Toggle checked={prefs.promo_offers} onChange={(v) => toggle('promo_offers', v)} label="Offers and promos" />} />
          <ListRow icon={Globe} label="Language" value="English" />
        </>,
      )}
      {group(
        'Support',
        <>
          <ListRow icon={CircleHelp} label="Help center" href="/help" />
          {isOwner ? <ListRow icon={Store} label="Restaurant orders" href="/restaurant/orders" /> : null}
          <ListRow icon={LogOut} label="Sign out" danger onClick={() => setConfirmOut(true)} />
        </>,
      )}
      <p className="t-caption text-text-muted">Order updates appear in Notifications inside Cravora. Email and push notifications aren’t set up.</p>

      <Sheet
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit profile"
        footer={
          <Button
            full
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await updateProfile({ displayName: form.displayName, phone: form.phone.trim() ? form.phone : null });
                if (!r.ok) return setErrors(r.fields ?? { displayName: r.error });
                setEdit(false);
                toast({ title: 'Profile updated' });
                router.refresh();
              })
            }
          >
            Save
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field id={`${id}-n`} label="Name" value={form.displayName} maxLength={60} onChange={(e) => setForm({ ...form, displayName: e.target.value })} error={errors.displayName} autoComplete="name" />
          <Field id={`${id}-p`} label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} autoComplete="tel" />
        </div>
      </Sheet>
      <ConfirmDialog open={confirmOut} title="Sign out?" message="Your cart and orders stay saved to your account." cancelLabel="Stay signed in" confirmLabel="Sign out" onCancel={() => setConfirmOut(false)} onConfirm={() => start(() => signOut())} loading={pending} />
    </>
  );
}
