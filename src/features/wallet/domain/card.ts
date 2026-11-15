import type { CachedCard, MemberStatus } from './types';

export const TOKEN_ROTATION_MS = 60_000;

export const TOKEN_RETRY_MS = 8_000;

export const CACHE_MAX_DAYS = 7;

const DAY_MS = 86_400_000;

export function isCacheExpired(
  cache: Pick<CachedCard, 'syncedAt'>,
  now = Date.now(),
): boolean {
  const age = now - new Date(cache.syncedAt).getTime();
  return !(age <= CACHE_MAX_DAYS * DAY_MS);
}

export type StatusTone = 'positive' | 'warning' | 'negative';

export type StatusSeal = { tone: StatusTone; label: string };

export function statusSeal(status: MemberStatus): StatusSeal {
  if (status === 'active') {
    return { tone: 'positive', label: 'Ativo' };
  }
  if (status === 'delinquent') {
    return { tone: 'negative', label: 'Inadimplente' };
  }
  if (status === 'suspended') {
    return { tone: 'warning', label: 'Suspenso' };
  }
  return { tone: 'negative', label: 'Desligado' };
}
