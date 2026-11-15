import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { rotateCardToken } from '../../data/walletRepository';
import { TOKEN_RETRY_MS, TOKEN_ROTATION_MS } from '../../domain';

export function useRotatingToken(memberId: string, onReconnect?: () => void) {
  const [token, setToken] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasOffline = false;

    async function rotate() {
      clearTimeout(timer);
      try {
        const next = await rotateCardToken(memberId);
        if (!active) {
          return;
        }
        setToken(next);
        setOffline(false);
        if (wasOffline) {
          wasOffline = false;
          onReconnectRef.current?.();
        }
        timer = setTimeout(rotate, TOKEN_ROTATION_MS);
      } catch {
        if (!active) {
          return;
        }
        setToken(null);
        setOffline(true);
        wasOffline = true;
        timer = setTimeout(rotate, TOKEN_RETRY_MS);
      }
    }

    rotate();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        rotate();
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [memberId]);

  return { token, offline };
}
