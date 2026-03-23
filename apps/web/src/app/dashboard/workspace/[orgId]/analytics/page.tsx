'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface QuizItem {
  id: string;
  title: string;
  status: string;
}

interface ClassItem {
  id: string;
}

interface InvitationItem {
  id: string;
  status: string;
  createdAt: string;
}

export default function WorkspaceAnalyticsPage(): JSX.Element {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const orgId = params.orgId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);

  useEffect(() => {
    async function loadData(): Promise<void> {
      const token = localStorage.getItem('quiz_access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        };
        const [quizzesRes, classesRes, invitesRes] = await Promise.all([
          fetch(`${API_BASE}/quizzes`, { headers }),
          fetch(`${API_BASE}/classes`, { headers }),
          fetch(`${API_BASE}/invitations`, { headers })
        ]);

        const quizzesPayload = (await quizzesRes.json()) as QuizItem[] | { message?: string };
        const classesPayload = (await classesRes.json()) as ClassItem[] | { message?: string };
        const invitesPayload = (await invitesRes.json()) as InvitationItem[] | { message?: string };

        setQuizzes(Array.isArray(quizzesPayload) ? quizzesPayload : []);
        setClasses(Array.isArray(classesPayload) ? classesPayload : []);
        setInvitations(Array.isArray(invitesPayload) ? invitesPayload : []);
      } catch {
        setError('Unable to load analytics data');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [orgId, router]);

  const publishedQuizzes = useMemo(() => quizzes.filter((quiz) => quiz.status === 'PUBLISHED').length, [quizzes]);
  const draftQuizzes = quizzes.length - publishedQuizzes;
  const pendingInvites = useMemo(() => invitations.filter((invite) => invite.status === 'PENDING').length, [invitations]);
  const acceptedInvites = useMemo(() => invitations.filter((invite) => invite.status === 'ACCEPTED').length, [invitations]);
  const inviteAcceptanceRate = invitations.length > 0 ? Math.round((acceptedInvites / invitations.length) * 100) : 0;

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading analytics...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            Workspace Analytics
          </h1>
          <p style={{ color: 'var(--muted)' }}>High-level operational metrics for this tenant.</p>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Link href={`/dashboard/workspace/${orgId}`} className="btn btn-ghost">
              Back
            </Link>
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        </div>
      </section>

      <section className="container" style={{ marginBottom: '1rem' }}>
        <div className="stats-grid">
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Total Quizzes</div>
            <strong style={{ fontSize: '1.2rem' }}>{quizzes.length}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Published</div>
            <strong style={{ fontSize: '1.2rem' }}>{publishedQuizzes}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Classes</div>
            <strong style={{ fontSize: '1.2rem' }}>{classes.length}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Invite Acceptance</div>
            <strong style={{ fontSize: '1.2rem' }}>{inviteAcceptanceRate}%</strong>
          </article>
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Quiz Health</h3>
            <div style={{ color: 'var(--muted)' }}>Draft quizzes: {draftQuizzes}</div>
            <div style={{ color: 'var(--muted)' }}>Published quizzes: {publishedQuizzes}</div>
          </article>

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Invite Funnel</h3>
            <div style={{ color: 'var(--muted)' }}>Pending: {pendingInvites}</div>
            <div style={{ color: 'var(--muted)' }}>Accepted: {acceptedInvites}</div>
            <div style={{ color: 'var(--muted)' }}>Total invites: {invitations.length}</div>
          </article>

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Operational Snapshot</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
              Use this page as a tenant-level command center until deep analytics pipeline is connected.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
