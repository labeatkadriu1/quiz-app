'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export default function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugLink, setDebugLink] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDebugLink(null);
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json()) as { message?: string; resetUrl?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to process request');
        return;
      }
      setSuccess('If this email exists, a reset link has been sent.');
      if (typeof payload.resetUrl === 'string' && payload.resetUrl.trim()) {
        setDebugLink(payload.resetUrl);
      }
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
        <h1 style={{ marginTop: '.2rem', marginBottom: '.7rem', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
          Reset Password
        </h1>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Enter your account email and we will send you a password reset link.
        </p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
        {debugLink ? (
          <div style={{ marginTop: '.6rem' }}>
            <label style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Local reset link:</label>
            <input
              readOnly
              value={debugLink}
              style={{ width: '100%', marginTop: '.25rem', fontSize: '.8rem', padding: '.45rem .6rem', borderRadius: 8, border: '1px solid var(--line)' }}
              onClick={(event) => (event.target as HTMLInputElement).select()}
            />
          </div>
        ) : null}

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
