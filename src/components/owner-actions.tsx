'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { updateOrderStatus } from '@/app/actions/shop';
import { NEXT_ACTION, TRANSITIONS } from '@/lib/domain/orders';
import type { OrderStatus } from '@/types/database';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { Button } from './ui';

export function OwnerOrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [reject, setReject] = useState(false);
  const next = NEXT_ACTION[status];
  const run = (to: OrderStatus, note?: string) =>
    start(async () => {
      const r = await updateOrderStatus(orderId, to, note);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t update the order', message: r.error });
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      {TRANSITIONS[status].includes('cancelled') ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => setReject(true)}>
          {status === 'pending' ? 'Reject' : 'Cancel'}
        </Button>
      ) : null}
      {next ? (
        <Button size="sm" variant="dark" loading={pending} onClick={() => run(next.to)}>
          {next.label}
        </Button>
      ) : null}
      <ConfirmDialog
        open={reject}
        title={status === 'pending' ? 'Reject this order?' : 'Cancel this order?'}
        message="The customer will be notified and nothing will be charged."
        cancelLabel="Keep order"
        confirmLabel={status === 'pending' ? 'Reject order' : 'Cancel order'}
        danger
        onCancel={() => setReject(false)}
        onConfirm={() => {
          setReject(false);
          run('cancelled', 'The restaurant couldn’t accept this order.');
        }}
      />
    </div>
  );
}
