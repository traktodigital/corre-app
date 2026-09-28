import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env } from '../config/env';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env;

/**
 * Mesmo ajuste do web (goias-delivery-link/src/integrations/supabase/client.ts):
 * chaves novas `sb_publishable_` vão só no header `apikey`, nunca como Bearer.
 */
const fetchComChave: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
  if (headers.get('Authorization') === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
    headers.delete('Authorization');
  }
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchComChave },
});

// Renova o token só com o app em primeiro plano (recomendação do supabase-js no RN).
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
