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

interface BillingStatus {
  organizationId: string;
  organizationName: string;
  planCode: string | null;
  billingStatus: string;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  paymentRequired: boolean;
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

type WorkspaceTab = 'OVERVIEW' | 'OPERATIONS' | 'ACTIVITY';

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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('OVERVIEW');
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [limits, setLimits] = useState<LimitsStatus | null>(null);
  const [activatingBilling, setActivatingBilling] = useState(false);

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
  const latestQuizzes = useMemo(() => quizzes.slice(0, 6), [quizzes]);
  const latestClasses = useMemo(() => classes.slice(0, 6), [classes]);
  const latestInvitations = useMemo(() => invitations.slice(0, 6), [invitations]);

  function formatOrgType(type: OrganizationType): string {
    return type
      .toLowerCase()
      .split('_')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

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

    const [quizzesRes, classesRes, invitesRes, billingRes, limitsRes] = await Promise.all([
      fetch(`${API_BASE}/quizzes`, { headers }),
      fetch(`${API_BASE}/classes`, { headers }),
      fetch(`${API_BASE}/invitations`, { headers }),
      fetch(`${API_BASE}/organizations/current/billing`, { headers }),
      fetch(`${API_BASE}/organizations/current/limits`, { headers })
    ]);

    const quizzesPayload = (await quizzesRes.json()) as QuizItem[] | { message?: string };
    const classesPayload = (await classesRes.json()) as ClassItem[] | { message?: string };
    const invitesPayload = (await invitesRes.json()) as InvitationItem[] | { message?: string };
    const billingPayload = (await billingRes.json()) as BillingStatus | { message?: string };
    const limitsPayload = (await limitsRes.json()) as LimitsStatus | { message?: string };

    setQuizzes(Array.isArray(quizzesPayload) ? quizzesPayload : []);
    setClasses(Array.isArray(classesPayload) ? classesPayload : []);
    setInvitations(Array.isArray(invitesPayload) ? invitesPayload : []);
    setBilling(billingRes.ok && 'billingStatus' in billingPayload ? billingPayload as BillingStatus : null);
    setLimits(limitsRes.ok && 'limits' in limitsPayload ? limitsPayload as LimitsStatus : null);
  }

  async function activateBilling(): Promise<void> {
    if (!membership) {
      return;
    }
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setActivatingBilling(true);
    try {
      const response = await fetch(`${API_BASE}/organizations/current/billing/activate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': membership.organization.id
        }
      });
      if (response.ok) {
        await refreshData();
      }
    } finally {
      setActivatingBilling(false);
    }
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
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Workspace Dashboard</p>
          <h1 style={{ margin: '.2rem 0', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            {membership.organization.name}
          </h1>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>
            Manage this tenant with a clear flow: review summary, run operations, then monitor activity.
          </p>
          <div className="chip-row">
            <span className="chip">Type: {formatOrgType(membership.organization.type)}</span>
            <span className="chip">Status: {membership.organization.status}</span>
            {billing?.planCode ? <span className="chip">Plan: {billing.planCode}</span> : null}
            {billing?.billingStatus ? <span className="chip">Billing: {billing.billingStatus}</span> : null}
            {billing?.billingStatus === 'TRIALING' ? <span className="chip">Trial left: {billing.trialDaysLeft} days</span> : null}
            {membership.role?.name ? <span className="chip">Role: {membership.role.name}</span> : null}
            {limits ? (
              <span className="chip">
                Usage: {limits.usage.members}/{limits.limits.memberLimit} members · {limits.usage.quizzes}/{limits.limits.quizLimit} quizzes
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
            <Link href={`/dashboard/workspace/${orgId}/assignment-requests`} className="btn btn-ghost">
              Approve Assignment Requests
            </Link>
          </div>
          {billing?.paymentRequired ? (
            <div
              style={{
                marginTop: '.75rem',
                border: '1px solid rgba(153, 27, 27, 0.25)',
                background: 'rgba(254, 242, 242, 0.9)',
                borderRadius: 12,
                padding: '.72rem .8rem'
              }}
            >
              <strong style={{ display: 'block', marginBottom: '.2rem' }}>Trial ended. Payment required.</strong>
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.9rem' }}>
                Your 30-day trial has ended. Activate payment to continue full workspace access.
              </p>
              <div style={{ marginTop: '.55rem' }}>
                <button className="btn btn-primary" type="button" onClick={() => void activateBilling()} disabled={activatingBilling}>
                  {activatingBilling ? 'Activating...' : 'Activate Payment'}
                </button>
              </div>
            </div>
          ) : null}
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
              onClick={() => router.push(`/dashboard/workspace/${membership.organization.id}/quizzes`)}
            >
              Open Quiz Studio
            </button>
          </div>
        </div>
      </section>

      <section className="container" style={{ marginBottom: '1rem' }}>
        <div className="glass-card" style={{ padding: '.65rem' }}>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
            {(['OVERVIEW', 'OPERATIONS', 'ACTIVITY'] as WorkspaceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'OVERVIEW' ? 'Overview' : tab === 'OPERATIONS' ? 'Operations' : 'Activity'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeTab === 'OVERVIEW' ? (
        <>
          <section className="container" style={{ marginBottom: '1rem' }}>
            <div className="stats-grid">
              <article className="glass-card" style={{ padding: '.85rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Total Quizzes</div>
                <strong style={{ fontSize: '1.3rem' }}>{quizzes.length}</strong>
              </article>
              <article className="glass-card" style={{ padding: '.85rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Published Quizzes</div>
                <strong style={{ fontSize: '1.3rem' }}>{publishedQuizCount}</strong>
              </article>
              <article className="glass-card" style={{ padding: '.85rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Classes</div>
                <strong style={{ fontSize: '1.3rem' }}>{classes.length}</strong>
              </article>
              <article className="glass-card" style={{ padding: '.85rem' }}>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Pending Invites</div>
                <strong style={{ fontSize: '1.3rem' }}>{pendingInviteCount}</strong>
              </article>
            </div>
          </section>

          <section className="container">
            <div className="feature-grid">
              <article className="glass-card" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Quick Start</h3>
                <div style={{ display: 'grid', gap: '.5rem', color: 'var(--muted)' }}>
                  <p style={{ margin: 0 }}>1. Create or open quizzes in Quiz Studio.</p>
                  <p style={{ margin: 0 }}>2. Organize classes and assign teachers/students.</p>
                  <p style={{ margin: 0 }}>3. Track results and performance analytics.</p>
                </div>
                <div style={{ marginTop: '.7rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                  <Link href={`/dashboard/workspace/${membership.organization.id}/quizzes`} className="btn btn-primary">
                    Go to Quizzes
                  </Link>
                  <Link href={`/dashboard/workspace/${membership.organization.id}/classes`} className="btn btn-ghost">
                    Go to Classes
                  </Link>
                </div>
              </article>

              <article className="glass-card" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Tenant Snapshot</h3>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  Workspace type: <strong style={{ color: 'var(--text)' }}>{formatOrgType(membership.organization.type)}</strong>
                </p>
                <p style={{ margin: '.35rem 0 0', color: 'var(--muted)' }}>
                  Active role: <strong style={{ color: 'var(--text)' }}>{membership.role?.name ?? 'Member'}</strong>
                </p>
                <p style={{ margin: '.35rem 0 0', color: 'var(--muted)' }}>
                  Operational status: <strong style={{ color: 'var(--text)' }}>{membership.organization.status}</strong>
                </p>
              </article>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'OPERATIONS' ? (
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
      ) : null}

      {activeTab === 'ACTIVITY' ? (
        <section className="container">
          <div className="feature-grid">
            <article className="glass-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Latest Quizzes</h3>
              {latestQuizzes.length === 0 ? (
                <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No quizzes yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {latestQuizzes.map((quiz) => (
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
              {latestClasses.length === 0 ? (
                <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No classes yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {latestClasses.map((classItem) => (
                    <div key={classItem.id}>{classItem.name}</div>
                  ))}
                </div>
              )}
            </article>

            <article className="glass-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Recent Invitations</h3>
              {latestInvitations.length === 0 ? (
                <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No invitations yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '.45rem' }}>
                  {latestInvitations.map((invite) => (
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
      ) : null}
    </main>
  );
}
