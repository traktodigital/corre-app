import type { RedemptionRefusal, RedemptionStatus } from './types';

export const REDEMPTION_VALIDITY_MINUTES = 15;

const VALIDITY_MS = REDEMPTION_VALIDITY_MINUTES * 60_000;

export function redemptionDeadline(generatedAt: string): number {
  return new Date(generatedAt).getTime() + VALIDITY_MS;
}

export function pollIntervalMs(
  generatedAt: string | undefined,
  now = Date.now(),
): number {
  if (!generatedAt) {
    return 5_000;
  }
  const elapsed = now - new Date(generatedAt).getTime();
  if (elapsed < 2 * 60_000) {
    return 5_000;
  }
  return elapsed < 10 * 60_000 ? 15_000 : 30_000;
}

export function openRedemptionCutoff(now = Date.now()): string {
  return new Date(now - VALIDITY_MS).toISOString();
}

export function displayedStatus(
  redemption: { status: RedemptionStatus; generatedAt: string },
  now = Date.now(),
): RedemptionStatus {
  if (redemption.status !== 'generated') {
    return redemption.status;
  }
  return now > redemptionDeadline(redemption.generatedAt)
    ? 'expired'
    : 'generated';
}

export const redemptionStatusLabel: Record<RedemptionStatus, string> = {
  generated: 'Aguardando balcão',
  validated: 'Validado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRedemptionCode(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `CC-${suffix}`;
}

export const refusals = {
  unavailable: { ok: false, reason: 'Essa oferta não está mais no ar.' },
  notStarted: { ok: false, reason: 'Essa oferta ainda não começou.' },
  ended: { ok: false, reason: 'O prazo dessa oferta já acabou.' },
  membersOnly: {
    ok: false,
    reason: 'Essa é exclusiva para associado em dia.',
    requiresMembership: true,
  },
  premiumOnly: {
    ok: false,
    reason: 'Essa é só para quem tem o plano premium.',
    requiresPremium: true,
  },
  rateLimited: {
    ok: false,
    reason: 'Calma! Muitos códigos em pouco tempo. Tenta em 1 minuto.',
  },
  usageLimitReached: {
    ok: false,
    reason: 'Você já usou essa oferta o máximo de vezes.',
  },
  generationFailed: {
    ok: false,
    reason: 'Não deu pra gerar o código. Tenta de novo.',
  },
} satisfies Record<string, RedemptionRefusal>;

const DB_MESSAGE_REFUSALS: ReadonlyArray<[string, RedemptionRefusal]> = [
  ['exclusiva de associado', refusals.membersOnly],
  ['premium', refusals.premiumOnly],
  ['muitos códigos', refusals.rateLimited],
  ['limite', refusals.usageLimitReached],
  ['nao comecou', refusals.notStarted],
  ['vencida', refusals.ended],
];

export function refusalFromDbMessage(message: string): RedemptionRefusal {
  const text = message.toLowerCase();
  const match = DB_MESSAGE_REFUSALS.find(([fragment]) =>
    text.includes(fragment),
  );
  return match ? match[1] : refusals.unavailable;
}

export function validityWindowRefusal(
  offer: { validFrom: string | null; validUntil: string | null },
  today: string,
): RedemptionRefusal | null {
  if (offer.validFrom && offer.validFrom > today) {
    return refusals.notStarted;
  }
  if (offer.validUntil && offer.validUntil < today) {
    return refusals.ended;
  }
  return null;
}
