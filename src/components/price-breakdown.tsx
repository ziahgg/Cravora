import { formatMoney } from '@/lib/domain/money';
import { cx } from './ui';

/** Order summary in the design's order: subtotal, delivery, service (4%), promo, total. */
export function PriceBreakdown({ count, subtotal, deliveryFee, freeDelivery, serviceFee, discount, promoCode, total, className }: { count: number; subtotal: number | string; deliveryFee: number | string; freeDelivery?: boolean; serviceFee: number | string; discount: number | string; promoCode?: string | null; total: number | string; className?: string }) {
  const row = (label: string, value: string, strong?: boolean) => (
    <div className={cx('flex justify-between gap-3', strong ? 't-section pt-3' : 't-body text-text-secondary')}>
      <dt>{label}</dt>
      <dd className={cx('num', strong ? '' : 't-body-m text-text')}>{value}</dd>
    </div>
  );
  return (
    <dl className={cx('flex flex-col gap-2 rounded-[24px] bg-surface p-4', className)}>
      {row(`Subtotal (${count} item${count === 1 ? '' : 's'})`, formatMoney(subtotal))}
      {row('Delivery fee', freeDelivery ? 'Free' : formatMoney(deliveryFee))}
      {row('Service fee (4%)', formatMoney(serviceFee))}
      {Number(discount) > 0 ? row(promoCode ? `Promo ${promoCode}` : 'Discount', `−${formatMoney(discount)}`) : null}
      <div className="mt-1 border-t border-divider" />
      {row('Total', formatMoney(total), true)}
    </dl>
  );
}
