'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface QuizItem {
  id: string;
  title: string;
  status: string;
  visibility: string;
  createdAt: string;
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
    } catch {
      setError('Unable to load quizzes');
    } finally {
      setLoading(false);
    }
  }

  async function createQuiz(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
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
          description: description.trim() || undefined
        })
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to create quiz');
        return;
      }

      setTitle('');
      setDescription('');
      await loadQuizzes();
    } catch {
      setError('Unable to create quiz');
    } finally {
      setBusy(false);
    }
  }

  async function publishQuiz(quizId: string): Promise<void> {
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
            Organization: <strong>{orgId}</strong>
          </p>
          <div className="chip-row">
            <span className="chip">Total: {quizzes.length}</span>
            <span className="chip">Published: {publishedCount}</span>
            <span className="chip">Draft: {quizzes.length - publishedCount}</span>
          </div>
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
              {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
              <button className="btn btn-primary" type="submit" disabled={busy}>
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
                        {quiz.status} · {quiz.visibility}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '.45rem' }}>
                      {quiz.status === 'DRAFT' ? (
                        <button type="button" className="btn btn-ghost" onClick={() => void publishQuiz(quiz.id)} disabled={busy}>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
