import { createClient } from '@supabase/supabase-js';
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
export const supabaseConfigured = Boolean(
  env?.VITE_SUPABASE_URL && env?.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = supabaseConfigured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null;
export function requireSupabase() {
  if (!supabase)
    throw new Error('The observation service has not been configured.');
  return supabase;
}
