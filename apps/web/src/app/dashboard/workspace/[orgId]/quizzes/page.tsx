'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
type QuizContentType = 'QUIZ' | 'FORM' | 'POLL_SURVEY' | 'MINIGAME' | 'PERSONALITY_QUIZ' | 'PREDICTOR' | 'LEADERBOARD' | 'STORY';

interface QuizItem {
  id: string;
  title: string;
  status: string;
  contentType?: QuizContentType;
  visibility: string;
  createdAt: string;
}

interface OrganizationMembership {
  organization: {
    id: string;
    name: string;
  };
}

interface BillingStatus {
  paymentRequired: boolean;
  billingStatus: string;
  trialDaysLeft: number;
}

interface LimitsStatus {
  limits: {
    memberLimit: number;
    quizLimit: number;
    monthlyAttemptLimit: number;
  };
  usage: {
    members: number;
    quizzes: number;
    monthlyAttempts: number;
  };
}

export default function WorkspaceQuizzesPage(): JSX.Element {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const orgId = params.orgId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<QuizContentType>('QUIZ');
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>(orgId);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [limits, setLimits] = useState<LimitsStatus | null>(null);

  const publishedCount = useMemo(() => quizzes.filter((quiz) => quiz.status === 'PUBLISHED').length, [quizzes]);

  useEffect(() => {
    void loadQuizzes();
  }, [orgId]);

  async function loadQuizzes(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/quizzes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as QuizItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        setError('Unable to load quizzes');
        return;
      }
      setQuizzes(payload);

      const [billingRes, limitsRes] = await Promise.all([
        fetch(`${API_BASE}/organizations/current/billing`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        }),
        fetch(`${API_BASE}/organizations/current/limits`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        })
      ]);
      const billingPayload = (await billingRes.json()) as BillingStatus | { message?: string };
      const limitsPayload = (await limitsRes.json()) as LimitsStatus | { message?: string };
      setBilling(billingRes.ok && 'billingStatus' in billingPayload ? billingPayload as BillingStatus : null);
      setLimits(limitsRes.ok && 'limits' in limitsPayload ? limitsPayload as LimitsStatus : null);

      const orgResponse = await fetch(`${API_BASE}/organizations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const orgPayload = (await orgResponse.json()) as OrganizationMembership[] | { message?: string };
      if (orgResponse.ok && Array.isArray(orgPayload)) {
        const activeOrg = orgPayload.find((item) => item.organization.id === orgId);
        if (activeOrg?.organization?.name) {
          setOrganizationName(activeOrg.organization.name);
        } else {
          setOrganizationName(orgId);
        }
      }
    } catch {
      setError('Unable to load quizzes');
    } finally {
      setLoading(false);
    }
  }

  async function createQuiz(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to create quizzes.');
      return;
    }
    if (title.trim().length < 2) {
      setError('Quiz title must be at least 2 characters');
      return;
    }

    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/quizzes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': orgId
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          contentType
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to create quiz');
        return;
      }

      setTitle('');
      setDescription('');
      setContentType('QUIZ');
      await loadQuizzes();
    } catch {
      setError('Unable to create quiz');
    } finally {
      setBusy(false);
    }
  }

  async function publishQuiz(quizId: string): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to publish quizzes.');
      return;
    }
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to publish quiz (add at least one question first)');
        return;
      }
      await loadQuizzes();
    } catch {
      setError('Unable to publish quiz');
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuiz(quiz: QuizItem): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to delete quizzes.');
      return;
    }
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setDeleteBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to delete quiz');
        return;
      }
      setDeleteTarget(null);
      await loadQuizzes();
    } catch {
      setError('Unable to delete quiz');
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading quizzes...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            Quiz Studio
          </h1>
          <p style={{ color: 'var(--muted)' }}>
            Organization: <strong>{organizationName}</strong>
          </p>
          <div className="chip-row">
            <span className="chip">Total: {quizzes.length}</span>
            <span className="chip">Published: {publishedCount}</span>
            <span className="chip">Draft: {quizzes.length - publishedCount}</span>
            {limits ? <span className="chip">Usage quizzes: {limits.usage.quizzes}/{limits.limits.quizLimit}</span> : null}
          </div>
          {billing?.paymentRequired ? (
            <p style={{ color: '#b45309', marginTop: '.6rem' }}>
              Feature locked: trial expired. Activate billing to create, publish, edit, or delete quizzes.
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem' }}>
            <Link href={`/dashboard/workspace/${orgId}`} className="btn btn-ghost">
              Back
            </Link>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Create Quiz</h3>
            <form onSubmit={createQuiz}>
              <div className="field">
                <label htmlFor="title">Title</label>
                <input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="description">Description</label>
                <input id="description" value={description} onChange={(event) => setDescription(event.target.value)} />
              </div>
              <div className="field">
                <label>Content Type</label>
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {([
                    { key: 'QUIZ', label: 'Quiz', desc: 'Scored Q&A format', enabled: true },
                    { key: 'FORM', label: 'Form', desc: 'Lead/data capture flow', enabled: true },
                    { key: 'POLL_SURVEY', label: 'Poll / Survey', desc: 'Coming soon', enabled: false },
                    { key: 'MINIGAME', label: 'Minigame', desc: 'Coming soon', enabled: false },
                    { key: 'PERSONALITY_QUIZ', label: 'Personality Quiz', desc: 'Coming soon', enabled: false },
                    { key: 'PREDICTOR', label: 'Predictor', desc: 'Score prediction card experience', enabled: true },
                    { key: 'LEADERBOARD', label: 'Leaderboard', desc: 'Coming soon', enabled: false },
                    { key: 'STORY', label: 'Story', desc: 'Coming soon', enabled: false }
                  ] as Array<{ key: QuizContentType; label: string; desc: string; enabled: boolean }>).map((item) => {
                    const selected = contentType === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="glass-card"
                        disabled={!item.enabled}
                        onClick={() => {
                          if (!item.enabled) {
                            return;
                          }
                          setContentType(item.key);
                        }}
                        style={{
                          padding: '.55rem .65rem',
                          textAlign: 'left',
                          border: selected ? '2px solid #334155' : '1px solid var(--line)',
                          opacity: item.enabled ? 1 : .64,
                          background: selected ? 'linear-gradient(90deg, rgba(30,64,175,.12), rgba(16,185,129,.10))' : undefined
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center' }}>
                          <strong>{item.label}</strong>
                          <span className="chip" style={{ fontSize: '.74rem' }}>
                            {selected ? 'Selected' : item.enabled ? 'Available' : 'Soon'}
                          </span>
                        </div>
                        <small style={{ color: 'var(--muted)' }}>{item.desc}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
              {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
              <button className="btn btn-primary" type="submit" disabled={busy || Boolean(billing?.paymentRequired)}>
                {busy ? 'Saving...' : 'Create Quiz'}
              </button>
            </form>
          </article>

          <article className="glass-card" style={{ padding: '1rem', gridColumn: 'span 2' }}>
            <h3 style={{ marginTop: 0 }}>Quiz List</h3>
            {quizzes.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No quizzes yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="glass-card"
                    style={{ padding: '.7rem', display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}
                  >
                    <div>
                      <strong>{quiz.title}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>
                        {quiz.status} · {(quiz.contentType ?? 'QUIZ').replace(/_/g, ' ')} · {quiz.visibility}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '.45rem' }}>
                      {quiz.status === 'DRAFT' ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void publishQuiz(quiz.id)}
                          disabled={busy || Boolean(billing?.paymentRequired)}
                        >
                          Publish
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => router.push(`/dashboard/workspace/${orgId}/quizzes/${quiz.id}/builder`)}
                      >
                        Add Questions
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => router.push(`/dashboard/workspace/${orgId}/quizzes/${quiz.id}/results`)}
                      >
                        Results Pro
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => router.push(`/dashboard/workspace/${orgId}/quizzes/${quiz.id}/publisher`)}
                      >
                        Publisher
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setDeleteTarget(quiz)}
                        disabled={Boolean(billing?.paymentRequired)}
                        style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff5f5' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      {deleteTarget ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, .58)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 60,
            padding: '1rem'
          }}
          onClick={() => {
            if (!deleteBusy) {
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="glass-card"
            style={{
              width: 'min(560px, 100%)',
              padding: '1rem',
              borderRadius: 18,
              border: '1px solid #fecaca',
              background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,247,247,.96))'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p style={{ margin: 0, color: '#991b1b', fontSize: '.8rem', letterSpacing: '.04em', fontWeight: 800 }}>DELETE QUIZ</p>
            <h3 style={{ margin: '.35rem 0 .45rem' }}>{deleteTarget.title}</h3>
            <p style={{ marginTop: 0, color: '#334155' }}>
              This action permanently deletes the quiz and all related content:
              questions, assignments, attempts, submissions, results, and analytics snapshots.
            </p>
            <div
              style={{
                border: '1px dashed #fca5a5',
                borderRadius: 12,
                padding: '.7rem',
                background: '#fff1f2',
                color: '#7f1d1d',
                fontSize: '.88rem'
              }}
            >
              Users and organizations are not deleted. Only this quiz and its data are removed.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.55rem', marginTop: '.9rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void deleteQuiz(deleteTarget)}
                disabled={deleteBusy}
                style={{ background: '#b91c1c', borderColor: '#b91c1c' }}
              >
                {deleteBusy ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
