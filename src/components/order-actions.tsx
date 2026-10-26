'use client';

import { RotateCcw, Star, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { cancelOrder, reorder, submitReview } from '@/app/actions/shop';
import { ConfirmDialog } from './overlays';
import { useToast } from './toast';
import { Button, cx } from './ui';

export function ReorderButton({ orderId, variant = 'primary', label = 'Reorder', full }: { orderId: string; variant?: 'primary' | 'dark'; label?: string; full?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={variant}
      icon={RotateCcw}
      full={full}
      loading={pending}
      className={full ? 'h-14 t-button' : undefined}
      onClick={() =>
        start(async () => {
          const r = await reorder(orderId);
          if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t reorder', message: r.error });
          if (!r.data.added) return toast({ kind: 'error', title: 'Nothing to reorder', message: 'These items aren’t available anymore.' });
          toast({ title: 'Added to a new cart', message: r.data.skipped ? `${r.data.skipped} item(s) are no longer available` : 'Review your cart before checkout' });
          router.push('/cart');
        })
      }
    >
      {label}
    </Button>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" icon={XCircle} full onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <ConfirmDialog
        open={open}
        title="Cancel this order?"
        message="The restaurant hasn’t confirmed it yet, so you can still cancel. Nothing will be charged."
        cancelLabel="Keep order"
        confirmLabel="Cancel order"
        danger
        loading={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            const r = await cancelOrder(orderId);
            setOpen(false);
            if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t cancel', message: r.error });
            toast({ title: 'Order cancelled' });
            router.refresh();
          })
        }
      />
    </>
  );
}

/** Polls the server while an order is in progress (no websocket/live GPS is implied). */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function ReviewForm({ orderId, restaurant }: { orderId: string; restaurant: string }) {
  const router = useRouter();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-3 rounded-[24px] bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitReview({ orderId, rating, comment });
          if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t save your rating', message: r.error });
          toast({ icon: Star, title: 'Thanks for rating!', message: restaurant });
          router.refresh();
        });
      }}
    >
      <p className="t-section">Rate {restaurant}</p>
      <div role="radiogroup" aria-label="Rating" className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setRating(n)} className="grid size-11 place-items-center rounded-full bg-surface-muted">
            <Star size={22} className={cx(n <= rating ? 'fill-star text-star' : 'text-text-muted')} aria-hidden />
          </button>
        ))}
      </div>
      <label htmlFor="review-comment" className="sr-only">
        Comment
      </label>
      <textarea id="review-comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything to add? (optional)" className="rounded-[16px] border border-border p-3 t-body outline-none focus:border-ink" />
      <Button type="submit" size="sm" variant="dark" disabled={!rating} loading={pending} className="self-start">
        Submit rating
      </Button>
    </form>
  );
}
