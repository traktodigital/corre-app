import type { Savings } from './types';

export type ValidatedRedemption = {
  savedAmount: number | null;
  validatedAt: string | null;
};

export function summarizeSavings(
  validated: ReadonlyArray<ValidatedRedemption>,
  monthStart: Date,
): Savings {
  return validated.reduce<Savings>(
    (acc, r) => ({
      total: acc.total + (r.savedAmount ?? 0),
      validatedThisMonth:
        acc.validatedThisMonth +
        (r.validatedAt && new Date(r.validatedAt) >= monthStart ? 1 : 0),
    }),
    { total: 0, validatedThisMonth: 0 },
  );
}
