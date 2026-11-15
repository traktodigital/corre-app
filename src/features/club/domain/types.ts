export type Category = { id: string; name: string; icon: string };

export type PartnerSummary = {
  id: string;
  name: string;
  neighborhood: string | null;
  city: string | null;
  logoUrl: string | null;
  rating: number | null;
  category: Category | null;
};

export type Partner = PartnerSummary & {
  description: string | null;
  address: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  openingHours: string | null;
};

export type OfferKind =
  | 'fixedDiscount'
  | 'percentDiscount'
  | 'cashback'
  | 'gift';

export type OfferPricing = {
  kind: OfferKind;
  discountValue: number | null;
  priceFrom: number | null;
  priceTo: number | null;
};

export type Offer = OfferPricing & {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  membersOnly: boolean;
  premiumOnly: boolean;
  featured: boolean;
  validFrom: string | null;
  validUntil: string | null;
  partnerId: string;
  partner: { id: string; name: string; city: string | null } | null;
};

export type RedemptionStatus =
  | 'generated'
  | 'validated'
  | 'expired'
  | 'cancelled';

export type Redemption = {
  id: string;
  code: string;
  qrToken: string;
  generatedAt: string;
  validatedAt: string | null;
  status: RedemptionStatus;
  savedAmount: number | null;
  offer: { id: string; title: string; rules: string | null } | null;
  partner: { id: string; name: string } | null;
};

export type RedemptionSummary = Pick<
  Redemption,
  'id' | 'code' | 'status' | 'generatedAt' | 'validatedAt' | 'savedAmount'
> & {
  offer: { title: string } | null;
  partner: { name: string } | null;
};

export type RedemptionRefusal = {
  ok: false;
  reason: string;
  requiresMembership?: boolean;
  requiresPremium?: boolean;
};

export type RedemptionResult =
  | { ok: true; redemptionId: string }
  | RedemptionRefusal;

export type Savings = { total: number; validatedThisMonth: number };
