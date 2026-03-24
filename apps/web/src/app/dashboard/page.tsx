'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type OrganizationType = 'SCHOOL' | 'PUBLISHER' | 'ACADEMY' | 'COMPANY' | 'TRAINING_CENTER' | 'MEDIA_BRAND';
type InviteScope = 'ACTIVE_ORG' | 'SPECIFIC_ORG' | 'ALL_ADMIN_ORGS' | 'ALL_SCHOOL_ORGS';

interface UserProfile {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface MeResponse {
  user?: UserProfile;
}

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

interface InvitationItem {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  role?: { key: string; name: string } | null;
}

interface PlanOption {
  code: string;
  name: string;
  priceMonthly: number;
  description: string;
  limits?: {
    memberLimit: number;
    quizLimit: number;
    monthlyAttemptLimit: number;
  };
}

interface ProductPlanGroup {
  productKey: 'SCHOOL' | 'PUBLISHER';
  title: string;
  plans: PlanOption[];
}

interface PlansPayload {
  trialDays: number;
  products: ProductPlanGroup[];
}

const ORG_TYPE_OPTIONS: Array<{ value: OrganizationType; label: string }> = [
  { value: 'COMPANY', label: 'Company' },
  { value: 'SCHOOL', label: 'School' },
  { value: 'ACADEMY', label: 'Academy' },
  { value: 'TRAINING_CENTER', label: 'Training Center' },
  { value: 'PUBLISHER', label: 'Publisher' },
  { value: 'MEDIA_BRAND', label: 'Media Brand' }
];

const INVITE_ROLE_OPTIONS = [
  'ORGANIZATION_ADMIN',
  'SCHOOL_ADMIN',
  'TEACHER',
  'STUDENT',
  'PUBLISHER_ADMIN',
  'PUBLISHER_EDITOR',
  'VIEWER_ANALYST'
] as const;

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState('');

  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState<OrganizationType>('COMPANY');
  const [createError, setCreateError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlansPayload | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemInfo, setRedeemInfo] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleKey, setInviteRoleKey] = useState<(typeof INVITE_ROLE_OPTIONS)[number]>('ORGANIZATION_ADMIN');
  const [inviteScope, setInviteScope] = useState<InviteScope>('ACTIVE_ORG');
  const [inviteSpecificOrganizationId, setInviteSpecificOrganizationId] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [inviteActionBusyId, setInviteActionBusyId] = useState<string | null>(null);

  const activeOrganization = useMemo(
    () => organizations.find((item) => item.organization.id === activeOrganizationId)?.organization ?? null,
    [organizations, activeOrganizationId]
  );
  const activeMembership = useMemo(
    () => organizations.find((item) => item.organization.id === activeOrganizationId) ?? null,
    [organizations, activeOrganizationId]
  );
  const hasAdminAccess = useMemo(
    () => organizations.some((item) => item.role?.key?.includes('ADMIN')),
    [organizations]
  );
  const adminOrganizations = useMemo(
    () => organizations.filter((item) => item.role?.key?.includes('ADMIN')),
    [organizations]
  );
  const pendingInvitationsCount = useMemo(
    () => invitations.filter((item) => item.status === 'PENDING').length,
    [invitations]
  );
  const activeRoleName = activeMembership?.role?.name ?? 'Member';
  const isSuperAdmin = (profile?.email ?? '').trim().toLowerCase() === 'kadriu84@gmail.com';
  const currentTypePlans = useMemo(() => {
    if (!plans) {
      return [] as PlanOption[];
    }
    const group = plans.products.find((item) => item.productKey === thisProductKey(organizationType));
    return group?.plans ?? [];
  }, [plans, organizationType]);
  const selectedPlan = useMemo(
    () => currentTypePlans.find((item) => item.code === selectedPlanCode) ?? null,
    [currentTypePlans, selectedPlanCode]
  );

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      const accessToken = localStorage.getItem('quiz_access_token');
      if (!accessToken) {
        router.replace('/login');
        return;
      }

      try {
        const [profileRes, orgsRes] = await Promise.all([
          fetch(`${API_BASE}/auth/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          }),
          fetch(`${API_BASE}/organizations`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        ]);
        const plansRes = await fetch(`${API_BASE}/organizations/plans`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const plansPayload = (await plansRes.json()) as PlansPayload;

        const profilePayload = (await profileRes.json()) as MeResponse;
        const orgsPayload = (await orgsRes.json()) as OrganizationMembership[];

        if (!profileRes.ok || !profilePayload.user) {
          throw new Error('Unauthorized');
        }

        setProfile(profilePayload.user);
        setOrganizations(Array.isArray(orgsPayload) ? orgsPayload : []);
        if (plansRes.ok && Array.isArray(plansPayload.products)) {
          setPlans(plansPayload);
          const initialGroup = plansPayload.products.find((group) =>
            thisProductKey(organizationType) === group.productKey
          );
          if (initialGroup?.plans?.[0]?.code) {
            setSelectedPlanCode(initialGroup.plans[0].code);
          }
        }
        const signupCode = localStorage.getItem('quiz_signup_redeem_code');
        if (signupCode && signupCode.trim()) {
          setRedeemCode(signupCode.trim().toUpperCase());
        }

        const persistedOrg = localStorage.getItem('quiz_active_org_id');
        const firstOrg = Array.isArray(orgsPayload) ? orgsPayload[0]?.organization.id : undefined;
        const nextOrgId = persistedOrg || firstOrg || '';
        setActiveOrganizationId(nextOrgId);
        if (nextOrgId) {
          localStorage.setItem('quiz_active_org_id', nextOrgId);
          await fetchInvitations(nextOrgId, accessToken);
        }
      } catch {
        localStorage.removeItem('quiz_access_token');
        localStorage.removeItem('quiz_refresh_token');
        localStorage.removeItem('quiz_active_org_id');
        setError('Session expired. Please login again.');
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    void bootstrap();
  }, [router]);

  useEffect(() => {
    if (!inviteSpecificOrganizationId && adminOrganizations.length > 0) {
      setInviteSpecificOrganizationId(adminOrganizations[0].organization.id);
    }
  }, [adminOrganizations, inviteSpecificOrganizationId]);

  useEffect(() => {
    if (!plans) {
      return;
    }
    const group = plans.products.find((item) => item.productKey === thisProductKey(organizationType));
    if (!group || group.plans.length === 0) {
      setSelectedPlanCode('');
      return;
    }
    const exists = group.plans.some((plan) => plan.code === selectedPlanCode);
    if (!exists) {
      setSelectedPlanCode(group.plans[0].code);
    }
  }, [organizationType, plans, selectedPlanCode]);

  function logout(): void {
    localStorage.removeItem('quiz_access_token');
    localStorage.removeItem('quiz_refresh_token');
    localStorage.removeItem('quiz_active_org_id');
    router.push('/login');
  }

  async function fetchInvitations(orgId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/invitations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as InvitationItem[] | { message?: string };
      if (response.ok && Array.isArray(payload)) {
        setInvitations(payload);
      } else {
        setInvitations([]);
      }
    } catch {
      setInvitations([]);
    }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreateError(null);
    setRedeemInfo(null);

    const trimmedName = organizationName.trim();
    if (trimmedName.length < 2) {
      setCreateError('Organization name must be at least 2 characters.');
      return;
    }
    if (!selectedPlanCode) {
      setCreateError('Select a plan to continue.');
      return;
    }

    const accessToken = localStorage.getItem('quiz_access_token');
    if (!accessToken) {
      router.push('/login');
      return;
    }

    setBusy(true);
    try {
      const createRes = await fetch(`${API_BASE}/organizations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: trimmedName,
          type: organizationType,
          planCode: selectedPlanCode,
          redeemCode: redeemCode.trim() || undefined
        })
      });

      const createPayload = (await createRes.json()) as {
        message?: string;
        id?: string;
        redeemCodeApplied?: {
          code: string;
          type: 'PERCENT' | 'FREE_PERIOD';
          percentOff?: number | null;
          freePeriodDays?: number | null;
        } | null;
      };
      if (!createRes.ok) {
        setCreateError(createPayload.message ?? 'Unable to create organization.');
        return;
      }

      const orgsRes = await fetch(`${API_BASE}/organizations`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const orgsPayload = (await orgsRes.json()) as OrganizationMembership[];
      setOrganizations(Array.isArray(orgsPayload) ? orgsPayload : []);

      const newOrgId = createPayload.id ?? (Array.isArray(orgsPayload) ? orgsPayload[0]?.organization.id : '');
      if (newOrgId) {
        setActiveOrganizationId(newOrgId);
        localStorage.setItem('quiz_active_org_id', newOrgId);
        await fetchInvitations(newOrgId, accessToken);
      }

      setOrganizationName('');
      setOrganizationType('COMPANY');
      setSelectedPlanCode('');
      setRedeemCode('');
      localStorage.removeItem('quiz_signup_redeem_code');
      if (createPayload.redeemCodeApplied) {
        const applied = createPayload.redeemCodeApplied;
        const summary =
          applied.type === 'PERCENT'
            ? `${applied.code} applied: ${applied.percentOff ?? 0}% discount`
            : `${applied.code} applied: ${applied.freePeriodDays ?? 0} free days`;
        setRedeemInfo(summary);
      }
    } catch {
      setCreateError('Unable to create organization. Check API connection.');
    } finally {
      setBusy(false);
    }
  }

  async function inviteUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.push('/login');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('Enter a valid email');
      return;
    }
    if (inviteScope === 'ACTIVE_ORG' && !activeOrganizationId) {
      setInviteError('Select an active organization first');
      return;
    }
    if (inviteScope === 'SPECIFIC_ORG' && !inviteSpecificOrganizationId) {
      setInviteError('Select one organization');
      return;
    }

    setInviteBusy(true);
    try {
      const response = await fetch(`${API_BASE}/invitations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-organization-id': activeOrganizationId
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          roleKey: inviteRoleKey,
          scope: inviteScope,
          specificOrganizationId: inviteScope === 'SPECIFIC_ORG' ? inviteSpecificOrganizationId : undefined
        })
      });

      const payload = (await response.json()) as {
        message?: string;
        createdCount?: number;
        deliveredCount?: number;
        invitations?: Array<{ acceptUrl?: string }>;
      };
      if (!response.ok) {
        setInviteError(payload.message ?? 'Invite failed');
        return;
      }

      const createdCount = payload.createdCount ?? 1;
      const deliveredCount = payload.deliveredCount ?? 0;
      const link = payload.invitations?.[0]?.acceptUrl ?? null;
      setInviteLink(link);
      setInviteSuccess(
        deliveredCount > 0
          ? `Invitation sent to ${inviteEmail.trim()}.`
          : `Invitation created. Email not sent (SMTP not configured). Copy the link below.`
      );
      setInviteEmail('');
      if (activeOrganizationId) {
        await fetchInvitations(activeOrganizationId, token);
      }
    } catch {
      setInviteError('Invite failed. Check API connection.');
    } finally {
      setInviteBusy(false);
    }
  }

  function onSelectOrganization(orgId: string): void {
    setActiveOrganizationId(orgId);
    localStorage.setItem('quiz_active_org_id', orgId);
    const token = localStorage.getItem('quiz_access_token');
    if (token) {
      void fetchInvitations(orgId, token);
    }
  }

  async function resendInvitation(invitationId: string): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token || !activeOrganizationId) {
      setInviteError('Login and active organization are required');
      return;
    }

    setInviteActionBusyId(invitationId);
    setInviteError(null);
    try {
      const response = await fetch(`${API_BASE}/invitations/${invitationId}/resend`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': activeOrganizationId
        }
      });
      const payload = (await response.json()) as { delivered?: boolean; reason?: string; message?: string; acceptUrl?: string };
      if (!response.ok) {
        setInviteError(payload.message ?? 'Unable to resend invitation');
        return;
      }

      if (payload.delivered) {
        setInviteSuccess('Invitation email resent successfully.');
        setInviteLink(null);
      } else {
        setInviteSuccess('Invitation resent. Email not sent (SMTP not configured). Copy the link below.');
        setInviteLink(payload.acceptUrl ?? null);
      }
      await fetchInvitations(activeOrganizationId, token);
    } catch {
      setInviteError('Unable to resend invitation');
      alert('Unable to resend invitation');
    } finally {
      setInviteActionBusyId(null);
    }
  }

  async function deleteInvitation(invitationId: string): Promise<void> {
    if (!confirm('Delete this invitation?')) {
      return;
    }

    const token = localStorage.getItem('quiz_access_token');
    if (!token || !activeOrganizationId) {
      setInviteError('Login and active organization are required');
      return;
    }

    setInviteActionBusyId(invitationId);
    setInviteError(null);
    try {
      const response = await fetch(`${API_BASE}/invitations/${invitationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': activeOrganizationId
        }
      });
      const payload = (await response.json()) as { deleted?: boolean; message?: string };
      if (!response.ok || !payload.deleted) {
        setInviteError(payload.message ?? 'Unable to delete invitation');
        return;
      }

      setInviteSuccess('Invitation deleted.');
      setInviteLink(null);
      await fetchInvitations(activeOrganizationId, token);
    } catch {
      setInviteError('Unable to delete invitation');
      alert('Unable to delete invitation');
    } finally {
      setInviteActionBusyId(null);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading your admin workspace...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <section className="container">
        <div className="glass-card dashboard-hero">
          <div className="dashboard-hero-top">
            <div>
              <p className="small-label">QuizOS Admin Panel</p>
              <h1 style={{ margin: '.2rem 0', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
                Welcome {profile?.firstName ?? 'Admin'}
              </h1>
              <p style={{ margin: 0, color: 'var(--muted)' }}>Signed in as {profile?.email}</p>
            </div>
            <div className="dashboard-actions">
              {isSuperAdmin ? (
                <Link href="/dashboard/superadmin" className="btn btn-ghost">
                  Super Admin
                </Link>
              ) : null}
              <Link href="/" className="btn btn-ghost">
                Landing
              </Link>
              <button className="btn btn-primary" onClick={logout} type="button">
                Logout
              </button>
            </div>
          </div>
          <div className="stats-grid" style={{ marginTop: '.85rem' }}>
            <div className="dashboard-kpi">
              <p className="dashboard-kpi-label">Organizations</p>
              <p className="dashboard-kpi-value">{organizations.length}</p>
            </div>
            <div className="dashboard-kpi">
              <p className="dashboard-kpi-label">Admin Access Orgs</p>
              <p className="dashboard-kpi-value">{adminOrganizations.length}</p>
            </div>
            <div className="dashboard-kpi">
              <p className="dashboard-kpi-label">Pending Invites</p>
              <p className="dashboard-kpi-value">{pendingInvitationsCount}</p>
            </div>
            <div className="dashboard-kpi">
              <p className="dashboard-kpi-label">Active Role</p>
              <p className="dashboard-kpi-value" style={{ fontSize: '1rem' }}>{activeRoleName}</p>
            </div>
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          {hasAdminAccess || organizations.length === 0 ? (
            <article className="glass-card tint-teal" style={{ padding: '1rem' }}>
              <div className="card-heading">
                <div>
                  <p className="small-label">Setup</p>
                  <h3 style={{ margin: '.1rem 0 0' }}>Company Setup Wizard</h3>
                </div>
              </div>
              <p style={{ color: 'var(--muted)', marginTop: 0 }}>
                Create organizations with dedicated tenant dashboards, isolated scopes, and select your plan upfront.
              </p>
              <form onSubmit={createOrganization} className="form-surface">
                <div className="field">
                  <label htmlFor="organizationName">Organization name</label>
                  <input
                    id="organizationName"
                    value={organizationName}
                    onChange={(event) => setOrganizationName(event.target.value)}
                    placeholder="Acme Learning"
                  />
                </div>
                <div className="field">
                  <label htmlFor="organizationType">Organization type</label>
                  <select
                    id="organizationType"
                    value={organizationType}
                    onChange={(event) => setOrganizationType(event.target.value as OrganizationType)}
                    style={{
                      width: '100%',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '0.72rem 0.8rem',
                      fontSize: '.95rem',
                      background: '#fff'
                    }}
                  >
                    {ORG_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="redeemCode">Redeem code (optional)</label>
                  <input
                    id="redeemCode"
                    value={redeemCode}
                    onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
                    placeholder="WELCOME40"
                  />
                  <p style={{ marginTop: '.25rem', color: 'var(--muted)', fontSize: '.82rem' }}>
                    Use owner-provided code for free period or % discount.
                  </p>
                </div>
                <div className="field">
                  <label>Choose Plan</label>
                  <p style={{ marginTop: '.25rem', color: 'var(--muted)', fontSize: '.84rem' }}>
                    {plans?.trialDays ?? 30}-day free trial. You can change plans later.
                  </p>
                  {currentTypePlans.length === 0 ? (
                    <p style={{ color: 'var(--muted)', margin: 0 }}>Loading plans...</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '.5rem' }}>
                      {currentTypePlans.map((plan) => (
                        <button
                          key={plan.code}
                          type="button"
                          className="glass-card"
                          onClick={() => setSelectedPlanCode(plan.code)}
                          style={{
                            padding: '.65rem .7rem',
                            textAlign: 'left',
                            border: selectedPlanCode === plan.code ? '2px solid #0f766e' : '1px solid var(--line)',
                            background:
                              selectedPlanCode === plan.code
                                ? 'linear-gradient(90deg, rgba(15,118,110,.1), rgba(30,64,175,.08))'
                                : '#fff'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
                            <strong>{plan.name}</strong>
                            <span className="chip">${plan.priceMonthly}/mo</span>
                          </div>
                          <small style={{ color: 'var(--muted)' }}>{plan.description}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedPlan ? (
                  <div
                    className="glass-card"
                    style={{
                      padding: '.75rem .8rem',
                      border: '1px solid var(--line)',
                      background: 'linear-gradient(120deg, rgba(15,118,110,.08), rgba(30,64,175,.06))'
                    }}
                  >
                    <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.78rem', letterSpacing: '.04em', fontWeight: 700 }}>
                      SELECTED PLAN SUMMARY
                    </p>
                    <h4 style={{ margin: '.25rem 0 .35rem' }}>
                      {selectedPlan.name} (${selectedPlan.priceMonthly}/mo) after trial
                    </h4>
                    <div className="chip-row">
                      <span className="chip">Members: {selectedPlan.limits?.memberLimit ?? '-'}</span>
                      <span className="chip">Quizzes: {selectedPlan.limits?.quizLimit ?? '-'}</span>
                      <span className="chip">Monthly Attempts: {selectedPlan.limits?.monthlyAttemptLimit ?? '-'}</span>
                    </div>
                    <p style={{ margin: '.55rem 0 0', color: 'var(--muted)', fontSize: '.82rem' }}>
                      Exceeding plan limits will lock related actions until you upgrade.
                    </p>
                  </div>
                ) : null}
                {createError ? <p style={{ color: '#b91c1c' }}>{createError}</p> : null}
                {redeemInfo ? <p style={{ color: '#065f46' }}>{redeemInfo}</p> : null}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Creating...' : 'Create Organization'}
                </button>
              </form>
            </article>
          ) : (
            <article className="glass-card tint-teal" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Member Access</h3>
              <p style={{ color: 'var(--muted)' }}>
                You are a member of organizations. Ask an admin role user to create new organizations.
              </p>
            </article>
          )}

          <article className="glass-card tint-amber" style={{ padding: '1rem' }}>
            <div className="card-heading">
              <div>
                <p className="small-label">Workspace</p>
                <h3 style={{ margin: '.1rem 0 0' }}>Workspace Switcher</h3>
              </div>
            </div>
            <p style={{ color: 'var(--muted)' }}>
              Select which organization you are currently managing in this admin panel.
            </p>
            {organizations.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No organization yet. Create one from the setup wizard.</p>
            ) : (
              <div className="field">
                <label htmlFor="activeOrganization">Active organization</label>
                <select
                  id="activeOrganization"
                  value={activeOrganizationId}
                  onChange={(event) => onSelectOrganization(event.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  {organizations.map((item) => (
                    <option key={item.organization.id} value={item.organization.id}>
                      {item.organization.name} ({item.organization.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {activeOrganization ? (
              <div className="chip-row" style={{ marginTop: '.5rem' }}>
                <span className="chip">Active: {activeOrganization.name}</span>
                <span className="chip">Type: {activeOrganization.type}</span>
                <span className="chip">Status: {activeOrganization.status}</span>
                {activeMembership?.role?.name ? <span className="chip">Role: {activeMembership.role.name}</span> : null}
              </div>
            ) : null}
            {activeOrganization ? (
              <div className="workspace-launch">
                <Link href={`/dashboard/workspace/${activeOrganization.id}`} className="btn btn-primary">
                  Open Active Dashboard
                </Link>
              </div>
            ) : null}
          </article>

          <article className="glass-card tint-blue" style={{ padding: '1rem' }}>
            <div className="card-heading">
              <div>
                <p className="small-label">Access Control</p>
                <h3 style={{ margin: '.1rem 0 0' }}>Invite User</h3>
              </div>
            </div>
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              Add admin/teacher/editor users per active org, all your orgs, or all your school organizations.
            </p>
            <form onSubmit={inviteUser} className="form-surface">
              <div className="field">
                <label htmlFor="inviteEmail">User email</label>
                <input
                  id="inviteEmail"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="field">
                <label htmlFor="inviteRoleKey">Role</label>
                <select
                  id="inviteRoleKey"
                  value={inviteRoleKey}
                  onChange={(event) => setInviteRoleKey(event.target.value as (typeof INVITE_ROLE_OPTIONS)[number])}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  {INVITE_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="inviteScope">Invite scope</label>
                <select
                  id="inviteScope"
                  value={inviteScope}
                  onChange={(event) => setInviteScope(event.target.value as InviteScope)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value="ACTIVE_ORG">Active organization only</option>
                  <option value="SPECIFIC_ORG">One specific organization</option>
                  <option value="ALL_ADMIN_ORGS">All my admin organizations</option>
                  <option value="ALL_SCHOOL_ORGS">All my school organizations</option>
                </select>
              </div>
              {inviteScope === 'SPECIFIC_ORG' ? (
                <div className="field">
                  <label htmlFor="inviteSpecificOrganizationId">Specific organization</label>
                  <select
                    id="inviteSpecificOrganizationId"
                    value={inviteSpecificOrganizationId}
                    onChange={(event) => setInviteSpecificOrganizationId(event.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '0.72rem 0.8rem',
                      fontSize: '.95rem',
                      background: '#fff'
                    }}
                  >
                    {adminOrganizations.map((item) => (
                      <option key={item.organization.id} value={item.organization.id}>
                        {item.organization.name} ({item.organization.type})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {inviteError ? <p style={{ color: '#b91c1c' }}>{inviteError}</p> : null}
              {inviteSuccess ? <p style={{ color: '#065f46', marginBottom: '.4rem' }}>{inviteSuccess}</p> : null}
              {inviteLink ? (
                <div style={{ marginBottom: '.8rem' }}>
                  <label style={{ fontSize: '.82rem', color: 'var(--muted)' }}>Invite link (copy and share manually):</label>
                  <div style={{ display: 'flex', gap: '.4rem', marginTop: '.25rem' }}>
                    <input
                      readOnly
                      value={inviteLink}
                      style={{ flex: 1, fontSize: '.8rem', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid var(--line)', background: '#f9fafb' }}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: '.8rem', padding: '0.4rem .8rem' }}
                      onClick={() => void navigator.clipboard.writeText(inviteLink)}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={inviteBusy}>
                {inviteBusy ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <article className="glass-card" style={{ padding: '1rem' }}>
          <div className="card-heading">
            <div>
              <p className="small-label">Directory</p>
              <h3 style={{ margin: '.1rem 0 0' }}>All Organizations</h3>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Each organization has a dedicated dashboard. Enter directly based on company type.
          </p>
          {organizations.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No organization yet.</p>
          ) : (
            <div className="list-stack">
              {organizations.map((item) => (
                <div
                  key={item.id}
                  className="list-row"
                >
                  <div>
                    <strong>{item.organization.name}</strong>
                    <div className="list-meta">
                      {item.organization.type} · {item.organization.status}
                      {item.role?.name ? ` · ${item.role.name}` : ''}
                    </div>
                  </div>
                  <div className="stacked-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onSelectOrganization(item.organization.id)}
                    >
                      Set Active
                    </button>
                    <Link href={`/dashboard/workspace/${item.organization.id}`} className="btn btn-primary">
                      Open Dashboard
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <article className="glass-card" style={{ padding: '1rem' }}>
          <div className="card-heading">
            <div>
              <p className="small-label">Invitations</p>
              <h3 style={{ margin: '.1rem 0 0' }}>Recent Invitations (Active Organization)</h3>
            </div>
          </div>
          {!activeOrganizationId ? (
            <p style={{ color: 'var(--muted)' }}>Select an active organization to see invitations.</p>
          ) : invitations.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No invitations yet.</p>
          ) : (
            <div className="list-stack">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  className="list-row"
                >
                  <div>
                    <strong>{invite.email}</strong>
                    <div className="list-meta">
                      {invite.role?.name ?? invite.role?.key ?? 'Role not set'} · {invite.status}
                    </div>
                  </div>
                  <div className="stacked-actions">
                    <span className={`status-pill ${invite.status.toLowerCase()}`}>{invite.status}</span>
                    <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void resendInvitation(invite.id)}
                      disabled={inviteActionBusyId === invite.id || invite.status !== 'PENDING'}
                    >
                      {inviteActionBusyId === invite.id ? 'Working...' : 'Resend'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void deleteInvitation(invite.id)}
                      disabled={inviteActionBusyId === invite.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}

function thisProductKey(type: OrganizationType): 'SCHOOL' | 'PUBLISHER' {
  if (type === 'PUBLISHER' || type === 'MEDIA_BRAND') {
    return 'PUBLISHER';
  }
  return 'SCHOOL';
}
