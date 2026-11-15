import { formatCurrency } from '../../../shared/format';
import type { OfferPricing } from './types';

export function discountSummary(offer: OfferPricing): string | null {
  if (offer.priceFrom != null && offer.priceTo != null) {
    return `De ${formatCurrency(offer.priceFrom)} por ${formatCurrency(
      offer.priceTo,
    )}`;
  }
  if (offer.discountValue == null) {
    return offer.kind === 'gift' ? 'Brinde' : null;
  }
  if (offer.kind === 'percentDiscount') {
    return `${offer.discountValue}% OFF`;
  }
  if (offer.kind === 'cashback') {
    return `${offer.discountValue}% de volta`;
  }
  return `${formatCurrency(offer.discountValue)} OFF`;
}
