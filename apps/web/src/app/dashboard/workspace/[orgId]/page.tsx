'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type OrganizationType = 'SCHOOL' | 'PUBLISHER' | 'ACADEMY' | 'COMPANY' | 'TRAINING_CENTER' | 'MEDIA_BRAND';

interface OrganizationMembership {
  id: string;
  organization: {
    id: string;
    name: string;
    type: OrganizationType;
    status: string;
  };
  role?: {
    key: string;
    name: string;
  } | null;
}

interface QuizItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface InvitationItem {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

function sectionsForType(type: OrganizationType): Array<{ title: string; desc: string; actionLabel: string; route: 'quizzes' | 'classes' | 'analytics' }> {
  if (type === 'SCHOOL') {
    return [
      {
        title: 'School Admin',
        desc: 'Manage school settings, permissions, and academic visibility rules.',
        actionLabel: 'Open Analytics',
        route: 'analytics'
      },
      {
        title: 'Classes',
        desc: 'Create classes, assign teachers/students, and structure grade groups.',
        actionLabel: 'Manage Classes',
        route: 'classes'
      },
      {
        title: 'Quiz Assignments',
        desc: 'Assign by student, class, multiple classes, or school-wide access.',
        actionLabel: 'Open Quizzes',
        route: 'quizzes'
      },
      {
        title: 'Results & Ranking',
        desc: 'Track score trends, pass rates, and class/school leaderboard performance.',
        actionLabel: 'Open Analytics',
        route: 'analytics'
      }
    ];
  }

  if (type === 'PUBLISHER' || type === 'MEDIA_BRAND') {
    return [
      {
        title: 'Quiz Studio',
        desc: 'Build and publish engagement quizzes with status workflow control.',
        actionLabel: 'Open Quizzes',
        route: 'quizzes'
      },
      {
        title: 'Embeds',
        desc: 'Manage iframe/SDK embeds, source domains, and placement control.',
        actionLabel: 'Open Analytics',
        route: 'analytics'
      },
      {
        title: 'CTA & Lead Forms',
        desc: 'Configure end-screen forms, offers, redirects, and conversion capture.',
        actionLabel: 'Open Quizzes',
        route: 'quizzes'
      },
      {
        title: 'Performance',
        desc: 'Analyze impressions, starts, completions, drop-off, and CTA conversion.',
        actionLabel: 'Open Analytics',
        route: 'analytics'
      }
    ];
  }

  return [
    {
      title: 'Team Management',
      desc: 'Invite members and assign role permissions for this tenant.',
      actionLabel: 'Open Classes',
      route: 'classes'
    },
    {
      title: 'Quiz Operations',
      desc: 'Create internal training or assessment quiz workflows.',
      actionLabel: 'Open Quizzes',
      route: 'quizzes'
    },
    {
      title: 'Workspace Analytics',
      desc: 'Review completion trends and participation performance.',
      actionLabel: 'Open Analytics',
      route: 'analytics'
    },
    {
      title: 'Admin Controls',
      desc: 'Configure tenant settings, branding, and compliance controls.',
      actionLabel: 'Open Analytics',
      route: 'analytics'
    }
  ];
}

export default function WorkspaceDashboardPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);

  useEffect(() => {
    async function loadWorkspace(): Promise<void> {
      const token = localStorage.getItem('quiz_access_token');
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/organizations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = (await response.json()) as OrganizationMembership[];
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error('Unable to load organizations');
        }
        setOrganizations(payload);

        const found = payload.find((item) => item.organization.id === orgId);
        if (!found) {
          setError('Workspace not found or no access.');
          return;
        }

        localStorage.setItem('quiz_active_org_id', found.organization.id);
        await loadWorkspaceData(found.organization.id, token);
      } catch {
        setError('Unable to load workspace details.');
      } finally {
        setLoading(false);
      }
    }

    void loadWorkspace();
  }, [router]);

  const membership = useMemo(
    () => organizations.find((item) => item.organization.id === orgId) ?? null,
    [organizations, orgId]
  );

  const sections = membership ? sectionsForType(membership.organization.type) : [];
  const publishedQuizCount = useMemo(
    () => quizzes.filter((quiz) => quiz.status === 'PUBLISHED').length,
    [quizzes]
  );
  const pendingInviteCount = useMemo(
    () => invitations.filter((invite) => invite.status === 'PENDING').length,
    [invitations]
  );

  useEffect(() => {
    if (!loading && organizations.length > 0 && !membership) {
      router.replace('/dashboard');
    }
    if (membership) {
      localStorage.setItem('quiz_active_org_id', membership.organization.id);
    }
  }, [loading, organizations, membership, router]);

  async function loadWorkspaceData(activeOrgId: string, token: string): Promise<void> {
    const headers = {
      Authorization: `Bearer ${token}`,
      'x-organization-id': activeOrgId
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
  }

  async function refreshData(): Promise<void> {
    if (!membership) {
      return;
    }
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setRefreshing(true);
    try {
      await loadWorkspaceData(membership.organization.id, token);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading workspace dashboard...</p>
        </section>
      </main>
    );
  }

  if (!membership) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p style={{ color: '#b91c1c' }}>{error ?? 'Workspace not found or no access.'}</p>
          <Link href="/dashboard" className="btn btn-ghost">
            Back to Admin Center
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Dedicated Tenant Dashboard</p>
          <h1 style={{ margin: '.2rem 0', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            {membership.organization.name}
          </h1>
          <div className="chip-row">
            <span className="chip">Type: {membership.organization.type}</span>
            <span className="chip">Status: {membership.organization.status}</span>
            {membership.role?.name ? <span className="chip">Role: {membership.role.name}</span> : null}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-ghost">
              Back to Admin Center
            </Link>
            <button className="btn btn-ghost" type="button" onClick={() => void refreshData()} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => alert('Quiz module route is next step. Use Admin Center invite/create flow for now.')}
            >
              Create Quiz
            </button>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginBottom: '1rem' }}>
        <div className="stats-grid">
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Total Quizzes</div>
            <strong style={{ fontSize: '1.2rem' }}>{quizzes.length}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Published Quizzes</div>
            <strong style={{ fontSize: '1.2rem' }}>{publishedQuizCount}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Classes</div>
            <strong style={{ fontSize: '1.2rem' }}>{classes.length}</strong>
          </article>
          <article className="glass-card" style={{ padding: '.8rem' }}>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Pending Invites</div>
            <strong style={{ fontSize: '1.2rem' }}>{pendingInviteCount}</strong>
          </article>
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          {sections.map((section) => (
            <article key={section.title} className="glass-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{section.title}</h3>
              <p style={{ color: 'var(--muted)', marginBottom: '.8rem' }}>{section.desc}</p>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => router.push(`/dashboard/workspace/${membership.organization.id}/${section.route}`)}
              >
                {section.actionLabel}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Latest Quizzes</h3>
            {quizzes.length === 0 ? (
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No quizzes yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.45rem' }}>
                {quizzes.slice(0, 5).map((quiz) => (
                  <div key={quiz.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                    <span>{quiz.title}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '.86rem' }}>{quiz.status}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Latest Classes</h3>
            {classes.length === 0 ? (
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No classes yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.45rem' }}>
                {classes.slice(0, 5).map((classItem) => (
                  <div key={classItem.id}>{classItem.name}</div>
                ))}
              </div>
            )}
          </article>

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Recent Invitations</h3>
            {invitations.length === 0 ? (
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No invitations yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '.45rem' }}>
                {invitations.slice(0, 5).map((invite) => (
                  <div key={invite.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                    <span>{invite.email}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '.86rem' }}>{invite.status}</span>
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
