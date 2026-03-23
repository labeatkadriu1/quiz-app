'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('quiz_access_token');
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const payload = (await response.json()) as {
        tokens?: { accessToken: string; refreshToken: string };
        user?: { email: string };
        message?: string;
      };

      if (!response.ok || !payload.tokens) {
        setError(payload.message ?? 'Login failed');
        return;
      }

      localStorage.setItem('quiz_access_token', payload.tokens.accessToken);
      localStorage.setItem('quiz_refresh_token', payload.tokens.refreshToken);
      setSuccess(`Welcome back ${payload.user?.email ?? ''}`);
      router.push('/dashboard');
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
          Login
        </h1>
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
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46', marginBottom: 0 }}>{success}</p> : null}

        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'var(--brand-strong)', fontWeight: 700 }}>
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
