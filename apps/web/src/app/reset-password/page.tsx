'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

function ResetPasswordContent(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password)
    }),
    [password]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!token || token.length < 20) {
      setError('Reset token is missing or invalid.');
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    const strong = Object.values(passwordChecks).filter(Boolean).length >= 4;
    if (!strong) {
      setError('Use a stronger password (at least 4 of 5 rules).');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to reset password');
        return;
      }
      setSuccess('Password updated. Redirecting to login...');
      setTimeout(() => router.push('/login'), 900);
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card">
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.85rem' }}>QuizOS</p>
        <h1 style={{ marginTop: '.2rem', marginBottom: '.8rem', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
          Set New Password
        </h1>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="checklist">
              <span className={passwordChecks.minLength ? 'ok' : ''}>8+ chars</span>
              <span className={passwordChecks.upper ? 'ok' : ''}>Uppercase</span>
              <span className={passwordChecks.lower ? 'ok' : ''}>Lowercase</span>
              <span className={passwordChecks.number ? 'ok' : ''}>Number</span>
              <span className={passwordChecks.symbol ? 'ok' : ''}>Symbol</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46', marginBottom: 0 }}>{success}</p> : null}

        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Back to{' '}
          <Link href="/login" style={{ color: 'var(--brand-strong)', fontWeight: 700 }}>
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense
      fallback={(
        <main className="auth-shell">
          <section className="glass-card auth-card">
            <p>Loading reset page...</p>
          </section>
        </main>
      )}
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
