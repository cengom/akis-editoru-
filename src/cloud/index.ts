import { createMockBackend } from './mockBackend';
import { supabase } from './supabaseClient';
import { createSupabaseBackend } from './supabaseBackend';
import type { CloudBackend } from './types';

/**
 * Kullanılacak bulut arka ucu:
 * - Geliştirmede `VITE_CLOUD_MOCK=1` ise tarayıcı içi sahte bulut,
 * - Supabase ortam değişkenleri tanımlıysa Supabase,
 * - hiçbiri yoksa `null` (bulut kapalı; uygulama yalnızca yerel taslakla çalışır).
 */
function pickBackend(): CloudBackend | null {
  if (import.meta.env.DEV && import.meta.env.VITE_CLOUD_MOCK === '1') return createMockBackend();
  return supabase ? createSupabaseBackend(supabase) : null;
}

export const cloud: CloudBackend | null = pickBackend();

export * from './types';
