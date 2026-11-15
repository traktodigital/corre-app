import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env } from '../config/env';

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env;

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

AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
