'use client';
import { createContext, useContext } from 'react';
import type { Snapshot, Watch, Notice } from '@/lib/rutems/domain';
type AppContext = {
  data: Snapshot | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  mode: 'demo' | 'real';
  setMode: (m: 'demo' | 'real') => void;
  refresh: () => Promise<void>;
  saved: string[];
  toggleSave: (id: string) => void;
  resetSaved: () => void;
  comparison: string[];
  setComparison: (ids: string[]) => void;
  watches: Watch[];
  setWatches: React.Dispatch<React.SetStateAction<Watch[]>>;
  notices: Notice[];
  setNotices: React.Dispatch<React.SetStateAction<Notice[]>>;
  storageError: string;
  message: string;
  announce: (m: string) => void;
};
export const Context = createContext<AppContext | null>(null);
export function useApp() {
  const c = useContext(Context);
  if (!c) throw Error('Missing RUTEMS provider');
  return c;
}
