'use client';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { supabase, requireSupabase } from '@/lib/rutems/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';
import { Auth, useAuth, type AuthState } from './auth-context';
export { useAuth } from './auth-context';
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'reload'>>({
    user: null,
    role: null,
    loading: true,
    aal: null,
    error: '',
  });
  const generation = useRef(0);
  const reload = async () => {
    const request = ++generation.current;
    if (!supabase) {
      setState({
        user: null,
        role: null,
        loading: false,
        aal: null,
        error: 'Supabase is not configured.',
      });
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (!data.user) {
      if (request === generation.current)
        setState({
          user: null,
          role: null,
          loading: false,
          aal: null,
          error: '',
        });
      return;
    }
    const member = await supabase
      .from('staff_members')
      .select('role,active')
      .eq('user_id', data.user.id)
      .maybeSingle();
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (request !== generation.current) return;
    setState({
      aal: assurance.data?.currentLevel || null,
      user: data.user,
      role: member.data?.active ? member.data.role : null,
      loading: false,
      error: member.error?.message || error?.message || '',
    });
  };
  useEffect(() => {
    // Synchronize authentication with the external Supabase session.
    /* oxlint-disable-next-line react/react-compiler */
    void reload();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        generation.current++;
        setState({
          user: null,
          role: null,
          loading: false,
          aal: null,
          error: '',
        });
      }
      setTimeout(() => void reload(), 0);
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  return <Auth.Provider value={{ ...state, reload }}>{children}</Auth.Provider>;
}
export function Login() {
  const { user, role, loading, error: accountError, reload } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'password'>(
    'login',
  );
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false);
  const [factor, setFactor] = useState(''),
    [qr, setQr] = useState(''),
    [code, setCode] = useState('');
  useEffect(() => {
    const s = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('password');
    });
    return () => s?.data.subscription.unsubscribe();
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setFeedback('');
    try {
      await task();
    } catch (e) {
      setFeedback(
        e instanceof Error ? e.message : 'Request failed. Please retry.',
      );
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    void run(async () => {
      const db = requireSupabase();
      const result =
        mode === 'login'
          ? await db.auth.signInWithPassword({ email, password })
          : mode === 'signup'
            ? await db.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin + '/login' },
              })
            : mode === 'password'
              ? await db.auth.updateUser({ password })
              : await db.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + '/login',
                });
      if (result.error) throw result.error;
      setPassword('');
      setFeedback(
        mode === 'signup'
          ? 'Check your email to confirm your account. Staff access requires administrator assignment.'
          : mode === 'reset'
            ? 'If this account exists, a password reset email has been requested.'
            : mode === 'password'
              ? 'Password updated.'
              : 'Signed in.',
      );
      await reload();
    });
  };
  if (loading)
    return (
      <div className="wrap page">
        <p>Checking your account…</p>
      </div>
    );
  return (
    <div className="wrap page auth-page">
      <p className="eyebrow">YOUR RUTEMS ACCOUNT</p>
      <h1>
        {user
          ? 'Account & access'
          : mode === 'signup'
            ? 'Create account'
            : mode === 'reset'
              ? 'Reset password'
              : 'Sign in'}
      </h1>
      {accountError && <p role="alert">{accountError}</p>}
      {user && mode !== 'password' ? (
        <>
          <p>
            Signed in as <strong>{user.email}</strong>
          </p>
          <p>Access: {role || 'Public account — no staff permissions'}</p>
          {role && (
            <Link className="button" href="/operator">
              Open Operator Workspace
            </Link>
          )}
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { error } = await requireSupabase().auth.signOut({
                    scope: 'local',
                  });
                  if (error) throw error;
                  await reload();
                })
              }
            >
              Sign out
            </Button>
            <Button variant="outline" onClick={() => setMode('password')}>
              Change password
            </Button>
            <Button variant="outline" onClick={() => void reload()}>
              Refresh permissions
            </Button>
          </div>
          {role === 'admin' && (
            <section className="saved-section">
              <h2>Administrator verification</h2>
              <p>Use an authenticator app to verify administrator actions.</p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const db = requireSupabase();
                    const listed = await db.auth.mfa.listFactors();
                    if (listed.error) throw listed.error;
                    const existing = listed.data.totp.find(
                      (f) => f.status === 'verified',
                    );
                    if (existing) {
                      setFactor(existing.id);
                      setFeedback(
                        'Enter the current code from your authenticator.',
                      );
                      return;
                    }
                    for (const old of listed.data.totp) {
                      await db.auth.mfa.unenroll({ factorId: old.id });
                    }
                    const r = await db.auth.mfa.enroll({
                      factorType: 'totp',
                      friendlyName: 'RUTEMS admin',
                    });
                    if (r.error) throw r.error;
                    setFactor(r.data.id);
                    setQr(r.data.totp.qr_code);
                  })
                }
              >
                Set up or verify authenticator
              </Button>
              {qr && (
                <Image
                  unoptimized
                  src={qr}
                  width="200"
                  height="200"
                  alt="Scan this private setup code with your authenticator app"
                />
              )}
              {factor && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      const r =
                        await requireSupabase().auth.mfa.challengeAndVerify({
                          factorId: factor,
                          code,
                        });
                      if (r.error) throw r.error;
                      setCode('');
                      setQr('');
                      setFeedback('Administrator verification complete.');
                      await reload();
                    });
                  }}
                >
                  <label htmlFor="auth-code">
                    Authenticator code
                    <Input
                      required
                      id="auth-code"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    Verify
                  </Button>
                </form>
              )}
            </section>
          )}
        </>
      ) : (
        <form onSubmit={submit} className="account-form">
          {mode !== 'password' && (
            <label htmlFor="auth-email">
              Email
              <Input
                id="auth-email"
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== 'reset' && (
            <label htmlFor="auth-password">
              Password
              <Input
                id="auth-password"
                type="password"
                minLength={mode === 'login' ? 1 : 12}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'signup'
                ? 'Create account'
                : mode === 'reset'
                  ? 'Request reset email'
                  : mode === 'password'
                    ? 'Update password'
                    : 'Sign in'}
          </Button>
          <div className="actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? 'Create account' : 'Back to sign in'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode('reset')}
            >
              Forgot password
            </Button>
          </div>
        </form>
      )}
      <output className="form-feedback" aria-live="polite">
        {feedback}
      </output>
    </div>
  );
}
