import { useEffect, useState } from 'react';
import {
  clearCardCache,
  readCardCache,
  saveCardCache,
} from '../../data/walletRepository';
import type { CachedCard, MembershipCard } from '../../domain';

export function useCardCache(
  userId: string | null,
  fetched: MembershipCard | null | undefined,
) {
  const [cache, setCache] = useState<CachedCard | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    readCardCache(userId).then(entry => {
      if (active) {
        setCache(entry);
        setCacheLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || fetched === undefined) {
      return;
    }
    if (fetched) {
      saveCardCache(userId, fetched).then(() =>
        readCardCache(userId).then(setCache),
      );
    } else {
      clearCardCache();
      setCache(null);
    }
  }, [userId, fetched]);

  return { cache, cacheLoaded };
}
