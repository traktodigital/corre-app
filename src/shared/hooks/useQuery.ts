import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type Query<T> = {
  data: T | undefined;
  loading: boolean;
  error: boolean;
  reload: (silent?: boolean) => Promise<void>;
};

type State<T> = {
  key: string | null;
  data: T | undefined;
  error: boolean;
  loading: boolean;
};

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { intervalMs?: number } = {},
): Query<T> {
  const [state, setState] = useState<State<T>>({
    key,
    data: undefined,
    error: false,
    loading: key !== null,
  });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const keyRef = useRef(key);
  keyRef.current = key;
  const lastRequest = useRef(0);

  const reload = useCallback(async (silent = false) => {
    const requestKey = keyRef.current;
    if (requestKey === null) {
      return;
    }
    const requestId = ++lastRequest.current;
    if (!silent) {
      setState(s =>
        s.key === requestKey
          ? { ...s, loading: true }
          : { key: requestKey, data: undefined, error: false, loading: true },
      );
    }
    let result: { ok: true; data: T } | { ok: false };
    try {
      result = { ok: true, data: await fetcherRef.current() };
    } catch {
      result = { ok: false };
    }
    if (requestId !== lastRequest.current || keyRef.current !== requestKey) {
      return;
    }
    setState(s =>
      result.ok
        ? { key: requestKey, data: result.data, error: false, loading: false }
        : {
            key: requestKey,
            data: s.key === requestKey ? s.data : undefined,
            error: true,
            loading: false,
          },
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload(true);
    }, [reload, key]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { intervalMs } = options;
  useEffect(() => {
    if (!intervalMs || key === null) {
      return;
    }
    const timer = setInterval(() => reload(true), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, key, reload]);

  const isCurrent = state.key === key;
  const data = isCurrent ? state.data : undefined;
  return {
    data,
    loading:
      key !== null && (isCurrent ? state.loading : true) && data === undefined,
    error: isCurrent && state.error,
    reload,
  };
}
