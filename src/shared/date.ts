const BRASILIA_OFFSET_MS = 3 * 3600_000;

export function todayInBrasilia(now = Date.now()): string {
  return new Date(now - BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

export function startOfMonthInBrasilia(now = Date.now()): Date {
  const [year, month] = todayInBrasilia(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1) + BRASILIA_OFFSET_MS);
}
