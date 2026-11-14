import type { DiscountType, OutletOfferSummary } from '@lotmorewins/types';
import { formatPercent } from './format';

/** A rupee amount without trailing ".00": ₹500, ₹62.5. */
export function formatRupees(amount: number): string {
  return `₹${Number(amount.toFixed(2)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** FIXED outlets give a ₹ amount; anything else (and older servers that do not send it) is a %. */
export function isFixed(type: DiscountType | null | undefined): boolean {
  return type === 'FIXED';
}

/**
 * The outlet's best discount as shown on its page: "₹500" for a FIXED outlet, "20%" otherwise.
 * Null when the outlet gives none.
 */
export function offerFigure(offer: OutletOfferSummary | null | undefined): string | null {
  if (!offer) return null;
  if (isFixed(offer.discountType)) {
    const flat = offer.maxFlatDiscount ?? 0;
    return flat > 0 ? formatRupees(flat) : null;
  }
  return offer.maxDiscount > 0 ? formatPercent(offer.maxDiscount) : null;
}

/** Short tile tag, "Upto 20%" or "Upto ₹500": the server's own when it sends one. Null when there is no discount. */
export function offerBadge(offer: OutletOfferSummary | null | undefined): string | null {
  if (!offer) return null;
  const figure = offerFigure(offer);
  if (!figure) return null;
  const badge = offer.badge?.trim();
  return badge ? badge : `Upto ${figure}`;
}

/** A bill's discount line label: "Discount (20%)", or just "Discount" when it was a ₹ amount chosen at billing. */
export function billDiscountLabel(bill: { discountType?: DiscountType; discountPercentage: number }): string {
  return isFixed(bill.discountType) ? 'Discount' : `Discount (${formatPercent(bill.discountPercentage)})`;
}
