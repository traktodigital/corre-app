import { useCallback, useEffect, useRef, useState } from 'react';
import { listClosedTrips, TRIP_PAGE_SIZE } from '../data/tripRepository';
import { appendPage, type TripListItem } from '../domain';

export type HistoryStatus = 'loading' | 'idle' | 'error' | 'end';

export function useTripHistory(userId: string | null) {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [status, setStatus] = useState<HistoryStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const tripsRef = useRef<TripListItem[]>([]);
  const busy = useRef(false);

  const load = useCallback(
    async (reset: boolean) => {
      if (busy.current || !userId) {
        return;
      }
      busy.current = true;
      setStatus('loading');
      try {
        const current = reset ? [] : tripsRef.current;
        const page = await listClosedTrips(
          current[current.length - 1]?.startedAt,
        );
        const next = appendPage(current, page);
        tripsRef.current = next;
        setTrips(next);
        setStatus(page.length < TRIP_PAGE_SIZE ? 'end' : 'idle');
      } catch {
        setStatus('error');
      } finally {
        busy.current = false;
      }
    },
    [userId],
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (status === 'idle') {
      load(false);
    }
  }, [status, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const retry = useCallback(() => load(tripsRef.current.length === 0), [load]);

  return { trips, status, refreshing, loadMore, refresh, retry };
}
