'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface AcceptPayload {
  message?: string;
  user?: { email: string };
  organization?: { name: string };
  tokens?: { accessToken: string; refreshToken: string };
}

export default function AcceptInvitePage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = useMemo(() => (params?.token ?? '').trim(), [params]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          password: password.trim() || undefined
        })
      });

      const payload = (await response.json()) as AcceptPayload;
      if (!response.ok || !payload.tokens) {
        setError(payload.message ?? 'Unable to accept invitation');
        return;
      }

      localStorage.setItem('quiz_access_token', payload.tokens.accessToken);
      localStorage.setItem('quiz_refresh_token', payload.tokens.refreshToken);
      setSuccess(`Joined ${payload.organization?.name ?? 'organization'} as ${payload.user?.email ?? ''}`);
      setTimeout(() => router.push('/dashboard'), 500);
    } catch {
      setError('Unable to accept invitation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card">
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.85rem' }}>QuizOS Invitation</p>
        <h1 style={{ marginTop: '.2rem', marginBottom: '.8rem', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
          Accept Invitation
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          If you are a new user, enter your name and password. Existing users can leave password blank.
        </p>

        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="password">Password (required for new account)</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Accepting...' : 'Accept and Continue'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}

        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Already a member? <Link href="/login" style={{ color: 'var(--brand-strong)', fontWeight: 700 }}>Login</Link>
        </p>
      </section>
    </main>
  );
}
