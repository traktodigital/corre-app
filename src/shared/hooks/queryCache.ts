type Entry = { data: unknown; at: number };

const entries = new Map<string, Entry>();

export const STALE = {
  always: 0,
  catalog: 10 * 60_000,
  reference: 60 * 60_000,
  immutable: Infinity,
} as const;

export function readCache<T>(key: string): { data: T; at: number } | undefined {
  return entries.get(key) as { data: T; at: number } | undefined;
}

export function writeCache(key: string, data: unknown, now = Date.now()) {
  entries.set(key, { data, at: now });
}

export function isFresh(key: string, staleMs: number, now = Date.now()) {
  const entry = entries.get(key);
  return entry !== undefined && now - entry.at < staleMs;
}

export function clearQueryCache() {
  entries.clear();
}
