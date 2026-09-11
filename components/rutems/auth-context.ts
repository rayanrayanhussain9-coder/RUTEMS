'use client';
import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';
export type AuthState = {
  user: User | null;
  role: 'admin' | 'operator' | null;
  loading: boolean;
  aal: string | null;
  error: string;
  reload: () => Promise<void>;
};
export const Auth = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  aal: null,
  error: '',
  reload: async () => {},
});
export const useAuth = () => useContext(Auth);
