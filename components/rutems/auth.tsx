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
  const [signupStep, setSignupStep] = useState<'email' | 'password' | 'sent'>(
    'email',
  );
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const switchMode = (next: typeof mode) => {
    setMode(next);
    setSignupStep('email');
    setPassword('');
    setConfirmPassword('');
    setEmailCode('');
    setShowPassword(false);
    setFeedback('');
  };
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
    if (busy) return;
    if ((mode === 'signup' || mode === 'login') && signupStep === 'email') {
      setEmail(email.trim());
      setSignupStep('password');
      setFeedback('');
      return;
    }
    if (
      (mode === 'signup' || mode === 'password') &&
      password !== confirmPassword
    ) {
      setFeedback(
        'Passwords do not match. Please enter the same password in both fields.',
      );
      return;
    }
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
      setConfirmPassword('');
      if (mode === 'signup') {
        setSignupStep('sent');
        setCooldown(60);
      }
      setFeedback(
        mode === 'signup'
          ? 'Check your inbox for your confirmation code. If you already have an account, sign in instead.'
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
      <div className="auth-card">
        <p className="eyebrow">YOUR RUTEMS ACCOUNT</p>
        <h1>
          {user
            ? 'Account & access'
            : mode === 'signup'
              ? signupStep === 'sent'
                ? 'Check your email'
                : 'Create account'
              : mode === 'password'
                ? 'Choose a new password'
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
          <>
            <p className="auth-intro">
              {mode === 'signup'
                ? 'Your local environment. One simple account.'
                : mode === 'reset'
                  ? 'We’ll send a secure link to help you get back in.'
                  : mode === 'password'
                    ? 'Choose a strong password you haven’t used elsewhere.'
                    : 'Welcome back. Start with your email.'}
            </p>
            {(mode === 'signup' || mode === 'login') && (
              <ol className="auth-steps" aria-label="Account progress">
                {(mode === 'signup'
                  ? ['Email', 'Password', 'Verify']
                  : ['Email', 'Password']
                ).map((label, index) => {
                  const current =
                    signupStep === 'email'
                      ? 0
                      : signupStep === 'password'
                        ? 1
                        : 2;
                  return (
                    <li
                      key={label}
                      aria-current={index === current ? 'step' : undefined}
                      className={index <= current ? 'active' : ''}
                    >
                      <span>{index < current ? '✓' : index + 1}</span>
                      {label}
                    </li>
                  );
                })}
              </ol>
            )}
            {mode === 'signup' && signupStep === 'sent' ? (
              <form
                className="account-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (busy) return;
                  void run(async () => {
                    const { error } = await requireSupabase().auth.verifyOtp({
                      email,
                      token: emailCode.trim(),
                      type: 'email',
                    });
                    if (error)
                      throw new Error(
                        'This code is invalid or has expired. Try again or request a new code.',
                      );
                    setEmailCode('');
                    setFeedback('Email verified. Welcome to RUTEMS.');
                    await reload();
                  });
                }}
              >
                <p>
                  Enter the code sent to <strong>{email}</strong>. Check your
                  spam folder if it hasn’t arrived.
                </p>
                <label htmlFor="email-code">
                  Verification code
                  <Input
                    id="email-code"
                    className="email-code"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6,10}"
                    minLength={6}
                    maxLength={10}
                    value={emailCode}
                    onChange={(e) =>
                      setEmailCode(e.target.value.replace(/\D/g, ''))
                    }
                  />
                </label>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Verifying…' : 'Verify and continue'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || cooldown > 0}
                  onClick={() =>
                    void run(async () => {
                      const { error } = await requireSupabase().auth.resend({
                        type: 'signup',
                        email,
                        options: {
                          emailRedirectTo: window.location.origin + '/login',
                        },
                      });
                      if (error) throw error;
                      setCooldown(60);
                      setFeedback(
                        'A new code has been requested. Use the latest email.',
                      );
                    })
                  }
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </Button>
                <div className="actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => switchMode('signup')}
                  >
                    Change email
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => switchMode('login')}
                  >
                    Back to sign in
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={submit} className="account-form">
                {(mode === 'signup' || mode === 'login') &&
                  signupStep === 'password' && (
                    <div className="auth-email-summary">
                      <span>{email}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          setSignupStep('email');
                          setPassword('');
                          setConfirmPassword('');
                          setFeedback('');
                        }}
                      >
                        Change email
                      </Button>
                    </div>
                  )}
                {mode !== 'password' &&
                  (mode === 'reset' || signupStep === 'email') && (
                    <label htmlFor="auth-email">
                      Email
                      <Input
                        id="auth-email"
                        autoComplete="email"
                        type="email"
                        placeholder="you@example.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                  )}
                {mode === 'password' ||
                (mode !== 'reset' && signupStep === 'password') ? (
                  <>
                    <label htmlFor="auth-password">
                      Password
                      <Input
                        id="auth-password"
                        type={showPassword ? 'text' : 'password'}
                        minLength={mode === 'login' ? 1 : 12}
                        autoComplete={
                          mode === 'login' ? 'current-password' : 'new-password'
                        }
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                    {mode !== 'login' && (
                      <>
                        <p className="micro">
                          Use at least 12 characters. A few memorable words work
                          well.
                        </p>
                        <label htmlFor="auth-confirm-password">
                          Confirm password
                          <Input
                            id="auth-confirm-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            minLength={12}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </label>
                      </>
                    )}
                    <Button
                      type="button"
                      className="auth-show-password"
                      variant="ghost"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide password' : 'Show password'}
                    </Button>
                  </>
                ) : null}
                <Button type="submit" disabled={busy}>
                  {busy
                    ? 'Please wait…'
                    : mode === 'reset'
                      ? 'Request reset email'
                      : mode === 'password'
                        ? 'Update password'
                        : signupStep === 'email'
                          ? 'Continue'
                          : mode === 'signup'
                            ? 'Send verification code'
                            : 'Sign in'}
                </Button>
                <div className="actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      switchMode(mode === 'login' ? 'signup' : 'login')
                    }
                  >
                    {mode === 'login' ? 'Create account' : 'Back to sign in'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => switchMode('reset')}
                  >
                    Forgot password
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
        <output className="form-feedback" aria-live="polite">
          {feedback}
        </output>
        <p className="auth-footer-note">
          Your account connects you to real environmental observations.
        </p>
      </div>
    </div>
  );
}
