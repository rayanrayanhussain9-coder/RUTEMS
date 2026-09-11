import type { Snapshot } from './domain';
export function apiBase() {
  return (
    (import.meta as ImportMeta & { env: Record<string, string> }).env
      ?.VITE_RUTEMS_API_URL || 'http://127.0.0.1:8788'
  );
}
export async function loadSnapshot(
  _mode: 'demo' | 'real',
  signal?: AbortSignal,
): Promise<Snapshot> {
  const { requireSupabase } = await import('./supabase');
  let query = requireSupabase().rpc('public_snapshot');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error)
    throw new Error('Observation service unavailable: ' + error.message);
  if (
    !data ||
    data.mode !== 'real' ||
    !Array.isArray(data.locations) ||
    !Array.isArray(data.observations)
  )
    throw new Error('Unexpected observation response');
  return data as Snapshot;
}
export function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
