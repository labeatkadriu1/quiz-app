'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface RequestContext {
  assignmentId: string;
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
  };
  organization: {
    id: string;
    name: string;
  };
  availability: {
    startAt?: string | null;
    endAt?: string | null;
    attemptLimit?: number | null;
  };
}

export default function AssignmentRequestPage(): JSX.Element {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [context, setContext] = useState<RequestContext | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/public/assignments/request-link/${token}`);
        const payload = (await response.json()) as RequestContext | { message?: string };
        if (!response.ok || !('assignmentId' in payload)) {
          setError(('message' in payload ? payload.message : null) ?? 'Request link not found');
          return;
        }
        setContext(payload);
      } catch {
        setError('Unable to load request link');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/public/assignments/request-link/${token}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email
        })
      });
      const payload = (await response.json()) as { status?: string; message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to submit request');
        return;
      }
      setSuccess(payload.message ?? 'Request submitted.');
      setName('');
      setEmail('');
    } catch {
      setError('Unable to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading request link...</p>
        </section>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p style={{ color: '#b91c1c' }}>{error ?? 'Request link not found.'}</p>
          <Link href="/" className="btn btn-ghost">Back to landing</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card" style={{ width: 'min(560px, 100%)' }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.85rem' }}>Assignment Access Request</p>
        <h1 style={{ margin: '.2rem 0 .4rem', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
          {context.quiz.title}
        </h1>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Organization: <strong>{context.organization.name}</strong>
        </p>
        {context.quiz.description ? <p style={{ marginTop: 0, color: 'var(--muted)' }}>{context.quiz.description}</p> : null}
        <div className="chip-row" style={{ marginBottom: '.8rem' }}>
          {context.availability.startAt ? <span className="chip">Start: {new Date(context.availability.startAt).toLocaleString()}</span> : null}
          {context.availability.endAt ? <span className="chip">End: {new Date(context.availability.endAt).toLocaleString()}</span> : null}
          {typeof context.availability.attemptLimit === 'number' ? <span className="chip">Attempts: {context.availability.attemptLimit}</span> : null}
        </div>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Submitting...' : 'Request Access'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
      </section>
    </main>
  );
}
