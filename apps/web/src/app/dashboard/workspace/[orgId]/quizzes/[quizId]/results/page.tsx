'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface AttemptItem {
  attemptId: string;
  status: string;
  startedAt: string;
  submittedAt?: string | null;
  percentage?: number | null;
  participant?: {
    email?: string | null;
    name?: string | null;
  } | null;
  answers: Array<{
    questionId: string;
    prompt: string;
    isCorrect: boolean | null;
    shortTextAnswer?: string | null;
    selectedOptionLabels?: string[];
    pointsAwarded?: number;
  }>;
}

interface AttemptsPayload {
  quiz: {
    id: string;
    title: string;
  };
  summary: {
    totalAttempts: number;
    submittedAttempts: number;
    averageScore: number;
  };
  attempts: AttemptItem[];
}

export default function QuizResultsProPage(): JSX.Element {
  const params = useParams<{ orgId: string; quizId: string }>();
  const router = useRouter();
  const orgId = params.orgId;
  const quizId = params.quizId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AttemptsPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'IN_PROGRESS'>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    void load();
  }, [orgId, quizId]);

  async function load(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/attempts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as AttemptsPayload | { message?: string };
      if (!response.ok || !('attempts' in payload)) {
        setError('Unable to load results');
        setData(null);
        return;
      }
      setData(payload);
    } catch {
      setError('Unable to load results');
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv(): void {
    if (!data) {
      return;
    }
    const rows = ['attempt_id,status,participant,submitted_at,score_percent,answers'];
    for (const attempt of filteredAttempts) {
      const answerSummary = attempt.answers
        .map((answer) => {
          const value = answer.shortTextAnswer || (answer.selectedOptionLabels ?? []).join('|') || '-';
          return `${answer.prompt}:${value}`;
        })
        .join(' || ')
        .replace(/"/g, '""');
      rows.push(
        [
          `"${attempt.attemptId}"`,
          `"${attempt.status}"`,
          `"${(attempt.participant?.email ?? attempt.participant?.name ?? 'Anonymous').replace(/"/g, '""')}"`,
          `"${attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : ''}"`,
          `"${String(attempt.percentage ?? 0)}"`,
          `"${answerSummary}"`
        ].join(',')
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-${quizId}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredAttempts = useMemo(() => {
    if (!data) {
      return [];
    }
    const q = search.trim().toLowerCase();
    return data.attempts.filter((attempt) => {
      if (statusFilter !== 'ALL' && attempt.status !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      const target = `${attempt.participant?.email ?? ''} ${attempt.participant?.name ?? ''}`.toLowerCase();
      return target.includes(q);
    });
  }, [data, statusFilter, search]);

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h1 style={{ marginTop: 0 }}>Results Pro</h1>
          <p style={{ color: 'var(--muted)' }}>
            {data?.quiz.title ?? 'Quiz'}: per-attempt answers, correctness, and export.
          </p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
            <Link href={`/dashboard/workspace/${orgId}/quizzes/${quizId}/builder`} className="btn btn-ghost">
              Back to Builder
            </Link>
            <button className="btn btn-primary" type="button" onClick={exportCsv} disabled={!data}>
              Export CSV
            </button>
          </div>
          {data ? (
            <div className="chip-row">
              <span className="chip">Attempts: {data.summary.totalAttempts}</span>
              <span className="chip">Submitted: {data.summary.submittedAttempts}</span>
              <span className="chip">Average: {data.summary.averageScore}%</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.8rem' }}>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'SUBMITTED' | 'IN_PROGRESS')}
              style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '.5rem .6rem' }}
            >
              <option value="ALL">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In progress</option>
            </select>
            <input
              placeholder="Filter by participant email/name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ minWidth: 280 }}
            />
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {loading ? <p>Loading results...</p> : null}
          {!loading && data ? (
            <div style={{ display: 'grid', gap: '.7rem', marginTop: '.8rem' }}>
              {filteredAttempts.map((attempt) => (
                <div key={attempt.attemptId} className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{attempt.participant?.name || attempt.participant?.email || 'Public / Anonymous'}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                        {attempt.status} · Score: {attempt.percentage ?? 0}% · Started:{' '}
                        {new Date(attempt.startedAt).toLocaleString()}
                      </div>
                      {attempt.submittedAt ? (
                        <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                          Submitted: {new Date(attempt.submittedAt).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    <span className="chip">{attempt.attemptId.slice(0, 8)}</span>
                  </div>
                  <div style={{ display: 'grid', gap: '.4rem', marginTop: '.6rem' }}>
                    {attempt.answers.map((answer) => (
                      <div key={`${attempt.attemptId}-${answer.questionId}`} className="glass-card" style={{ padding: '.55rem' }}>
                        <strong style={{ fontSize: '.9rem' }}>{answer.prompt}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                          Answer: {answer.shortTextAnswer || (answer.selectedOptionLabels ?? []).join(', ') || '-'}
                        </div>
                        <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                          Correct: {answer.isCorrect === null ? 'N/A' : answer.isCorrect ? 'Yes' : 'No'} · Points:{' '}
                          {answer.pointsAwarded ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
