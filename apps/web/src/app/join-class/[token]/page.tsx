'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface JoinInfo {
  classId: string;
  className: string;
  schoolName: string;
  organizationId: string;
  expiresAt?: string | null;
}

export default function JoinClassPage(): JSX.Element {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    void loadInfo();
  }, [token]);

  async function loadInfo(): Promise<void> {
    setLoading(true);
    setError(null);
    const response = await fetch(`${API_BASE}/classes/public/join/${token}`);
    const payload = (await response.json()) as JoinInfo | { message?: string };
    if (!response.ok || 'message' in payload) {
      setError(('message' in payload ? payload.message : null) ?? 'Invalid join link');
      setLoading(false);
      return;
    }
    setInfo(payload as JoinInfo);
    setLoading(false);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (email.trim().length < 5) {
      setError('Valid email is required');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/classes/public/join/${token}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          note: note.trim() || undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to submit request');
        return;
      }
      setSuccess(payload.message ?? 'Request submitted');
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading class join info...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card" style={{ width: 'min(640px, 100%)' }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>Class Join Request</p>
        <h1 style={{ margin: '.3rem 0 .5rem' }}>{info?.className ?? 'Class'}</h1>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>School: {info?.schoolName ?? '-'}</p>
        {info?.expiresAt ? (
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>Link expires: {new Date(info.expiresAt).toLocaleString()}</p>
        ) : null}

        <form onSubmit={submitRequest}>
          <div className="field">
            <label htmlFor="email">Your email (must match your school account)</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="note">Message (optional)</label>
            <input id="note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Submitting...' : 'Request to Join'}
          </button>
        </form>

        <div style={{ marginTop: '.7rem' }}>
          <Link href="/" className="btn btn-ghost">
            Back to Landing
          </Link>
        </div>
      </section>
    </main>
  );
}
