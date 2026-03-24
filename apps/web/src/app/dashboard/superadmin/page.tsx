'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const SUPER_ADMIN_EMAIL = 'kadriu84@gmail.com';

interface RedeemCodeItem {
  id: string;
  organizationId?: string | null;
  code: string;
  type: 'PERCENT' | 'FREE_PERIOD';
  percentOff?: number | null;
  freePeriodDays?: number | null;
  maxRedemptions?: number | null;
  maxPerClient: number;
  redemptionCount: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active: boolean;
  newSignupsOnly: boolean;
  createdByEmail?: string | null;
  createdAt: string;
}

interface ClientItem {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  subscription: {
    planCode: string;
    billingStatus: string;
    trialStartedAt?: string | null;
    trialEndsAt?: string | null;
    trialDaysLeft: number;
  } | null;
  usage: {
    members: number;
    quizzes: number;
    classes: number;
    redeemCodes: number;
    codeRedemptions: number;
  };
  adminEmails: string[];
  redeemCodes: RedeemCodeItem[];
}

interface MeResponse {
  user?: {
    email: string;
  };
}

interface ClientDetailsPayload {
  organization: {
    id: string;
    name: string;
    type: string;
    status: string;
    createdAt: string;
    subscription: {
      planCode: string;
      billingStatus: string;
      trialStartedAt?: string | null;
      trialEndsAt?: string | null;
    } | null;
  };
  members: Array<{
    id: string;
    status: string;
    joinedAt: string;
    role?: {
      key: string;
      name: string;
    } | null;
    user: {
      id: string;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      status: string;
      lastLoginAt?: string | null;
      createdAt: string;
    };
  }>;
  redeemCodes: RedeemCodeItem[];
  redeemUsages: Array<{
    id: string;
    usedAt: string;
    redeemCode: {
      code: string;
      type: string;
      percentOff?: number | null;
      freePeriodDays?: number | null;
    };
    actor?: {
      id: string;
      email: string;
      name?: string | null;
    } | null;
  }>;
  recentAudit: Array<{
    id: string;
    createdAt: string;
    action: string;
    resourceType: string;
    resourceId: string;
    actor?: {
      id: string;
      email: string;
      name?: string | null;
    } | null;
    payload?: unknown;
  }>;
}

type UsageMode = 'ONE_TIME' | 'MULTI_USE' | 'UNLIMITED';

export default function SuperAdminPage(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [globalCodes, setGlobalCodes] = useState<RedeemCodeItem[]>([]);
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<ClientDetailsPayload | null>(null);
  const [globalCustomCode, setGlobalCustomCode] = useState('');
  const [globalCodeType, setGlobalCodeType] = useState<'PERCENT' | 'FREE_PERIOD'>('PERCENT');
  const [globalPercentOff, setGlobalPercentOff] = useState(40);
  const [globalFreeDays, setGlobalFreeDays] = useState(30);
  const [globalUsageMode, setGlobalUsageMode] = useState<UsageMode>('ONE_TIME');
  const [globalMaxRedemptions, setGlobalMaxRedemptions] = useState(10);
  const [globalMaxPerClient, setGlobalMaxPerClient] = useState(1);
  const [globalValidUntil, setGlobalValidUntil] = useState('');
  const [globalNewSignupsOnly, setGlobalNewSignupsOnly] = useState(true);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const meRes = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const mePayload = (await meRes.json()) as MeResponse;
      const currentEmail = mePayload.user?.email?.toLowerCase() ?? null;
      setEmail(currentEmail);
      if (currentEmail !== SUPER_ADMIN_EMAIL) {
        setError('Super admin access required.');
        setLoading(false);
        return;
      }
      await Promise.all([loadClients(''), loadGlobalCodes()]);
    } catch {
      setError('Unable to load super admin page');
      setLoading(false);
    }
  }

  async function loadClients(nextQuery?: string): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = (nextQuery ?? query).trim();
      const params = new URLSearchParams();
      if (q) {
        params.set('q', q);
      }
      const response = await fetch(`${API_BASE}/superadmin/clients${params.toString() ? `?${params.toString()}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as ClientItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        const message = !Array.isArray(payload) ? payload.message : undefined;
        setError(message ?? 'Unable to load clients');
        setClients([]);
      } else {
        setClients(payload);
      }
    } catch {
      setError('Unable to load clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadGlobalCodes(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/superadmin/redeem-codes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as RedeemCodeItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        return;
      }
      setGlobalCodes(payload);
    } catch {
      setGlobalCodes([]);
    }
  }

  async function toggleFreeAccess(client: ClientItem, enabled: boolean): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId(client.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/clients/${client.id}/free-access`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to update free access');
        return;
      }
      await Promise.all([loadClients(), loadGlobalCodes()]);
    } finally {
      setBusyId(null);
    }
  }

  async function extendTrial(client: ClientItem, days: number): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId(client.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/clients/${client.id}/extend-trial`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to extend trial');
        return;
      }
      await loadClients();
    } finally {
      setBusyId(null);
    }
  }

  async function grantFreePeriod(client: ClientItem, days: number): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId(client.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/clients/${client.id}/grant-free-period`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ days })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to grant free period');
        return;
      }
      await loadClients();
    } finally {
      setBusyId(null);
    }
  }

  async function createClientCode(client: ClientItem, body: Record<string, unknown>): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId(client.id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/clients/${client.id}/redeem-codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok || !payload.code) {
        setError(payload.message ?? 'Unable to create redeem code');
        return;
      }
      await navigator.clipboard.writeText(payload.code);
      await loadClients();
    } finally {
      setBusyId(null);
    }
  }

  async function createGlobalCode(body: Record<string, unknown>): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId('global-codes');
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/redeem-codes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json()) as { code?: string; message?: string };
      if (!response.ok || !payload.code) {
        setError(payload.message ?? 'Unable to create global code');
        return;
      }
      await navigator.clipboard.writeText(payload.code);
      await loadGlobalCodes();
    } finally {
      setBusyId(null);
    }
  }

  async function createDynamicGlobalCode(): Promise<void> {
    if (globalCodeType === 'PERCENT' && (globalPercentOff < 1 || globalPercentOff > 100)) {
      setError('Percent discount must be between 1 and 100.');
      return;
    }
    if (globalCodeType === 'FREE_PERIOD' && globalFreeDays < 1) {
      setError('Free days must be at least 1.');
      return;
    }
    if (globalUsageMode === 'MULTI_USE' && globalMaxRedemptions < 2) {
      setError('Multiple-use code must allow at least 2 redemptions.');
      return;
    }
    if (globalMaxPerClient < 1) {
      setError('Per-client usage must be at least 1.');
      return;
    }

    const body: Record<string, unknown> = {
      type: globalCodeType,
      maxPerClient: globalMaxPerClient,
      newSignupsOnly: globalNewSignupsOnly
    };
    if (globalCustomCode.trim()) {
      body.code = globalCustomCode.trim().toUpperCase();
    }
    if (globalCodeType === 'PERCENT') {
      body.percentOff = globalPercentOff;
    } else {
      body.freePeriodDays = globalFreeDays;
    }
    if (globalUsageMode === 'ONE_TIME') {
      body.maxRedemptions = 1;
    } else if (globalUsageMode === 'MULTI_USE') {
      body.maxRedemptions = globalMaxRedemptions;
    }
    if (globalValidUntil) {
      body.validUntil = new Date(`${globalValidUntil}T23:59:59.000Z`).toISOString();
    }

    await createGlobalCode(body);
  }

  async function disableCode(code: string, organizationId: string | null): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setBusyId(code);
    setError(null);
    try {
      const endpoint = organizationId
        ? `${API_BASE}/superadmin/clients/${organizationId}/redeem-codes/${encodeURIComponent(code)}`
        : `${API_BASE}/superadmin/redeem-codes/${encodeURIComponent(code)}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to disable code');
        return;
      }
      await Promise.all([loadClients(), loadGlobalCodes()]);
    } finally {
      setBusyId(null);
    }
  }

  async function openDetails(clientId: string): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      return;
    }
    setDetailsClientId(clientId);
    setDetailsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/superadmin/clients/${clientId}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = (await response.json()) as ClientDetailsPayload | { message?: string };
      if (!response.ok || !('organization' in payload)) {
        setError('Unable to load client details');
        setDetails(null);
        return;
      }
      setDetails(payload);
    } catch {
      setError('Unable to load client details');
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeDetails(): void {
    setDetailsClientId(null);
    setDetails(null);
    setDetailsLoading(false);
  }

  const stats = useMemo(() => {
    const activeBilling = clients.filter((item) => item.subscription?.billingStatus === 'ACTIVE').length;
    return {
      total: clients.length,
      activeBilling
    };
  }, [clients]);

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Platform Super Admin</p>
          <h1 style={{ margin: '.2rem 0' }}>Client Control Center</h1>
          <p style={{ color: 'var(--muted)' }}>
            Signed in as {email ?? '-'}.
            Manage trials, free months, and redeem codes.
          </p>
          <div className="chip-row">
            <span className="chip">Clients: {stats.total}</span>
            <span className="chip">Billing Active: {stats.activeBilling}</span>
            <span className="chip">Global Codes: {globalCodes.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn btn-ghost">Back</Link>
            <input
              placeholder="Search client by name/id"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ minWidth: 280 }}
            />
            <button className="btn btn-primary" type="button" onClick={() => void loadClients()}>
              Search
            </button>
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
        </div>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <article className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Create Global Redeem Code</h3>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'end' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Code (optional)</label>
              <input
                value={globalCustomCode}
                onChange={(event) => setGlobalCustomCode(event.target.value.toUpperCase())}
                placeholder="WELCOME40"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Type</label>
              <select value={globalCodeType} onChange={(event) => setGlobalCodeType(event.target.value as 'PERCENT' | 'FREE_PERIOD')}>
                <option value="PERCENT">Percent Discount</option>
                <option value="FREE_PERIOD">Free Period (Days)</option>
              </select>
            </div>
            {globalCodeType === 'PERCENT' ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Percent Off</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={globalPercentOff}
                  onChange={(event) => setGlobalPercentOff(Number(event.target.value || 0))}
                />
              </div>
            ) : (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Free Days</label>
                <input
                  type="number"
                  min={1}
                  value={globalFreeDays}
                  onChange={(event) => setGlobalFreeDays(Number(event.target.value || 0))}
                />
              </div>
            )}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Usage</label>
              <select value={globalUsageMode} onChange={(event) => setGlobalUsageMode(event.target.value as UsageMode)}>
                <option value="ONE_TIME">One Time</option>
                <option value="MULTI_USE">Multiple Times</option>
                <option value="UNLIMITED">Unlimited</option>
              </select>
            </div>
            {globalUsageMode === 'MULTI_USE' ? (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Max Redemptions</label>
                <input
                  type="number"
                  min={2}
                  value={globalMaxRedemptions}
                  onChange={(event) => setGlobalMaxRedemptions(Number(event.target.value || 0))}
                />
              </div>
            ) : null}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Max Per Client</label>
              <input
                type="number"
                min={1}
                value={globalMaxPerClient}
                onChange={(event) => setGlobalMaxPerClient(Number(event.target.value || 1))}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Valid Until (optional)</label>
              <input
                type="date"
                value={globalValidUntil}
                onChange={(event) => setGlobalValidUntil(event.target.value)}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '.45rem', marginTop: '.75rem' }}>
            <input
              type="checkbox"
              checked={globalNewSignupsOnly}
              onChange={(event) => setGlobalNewSignupsOnly(event.target.checked)}
            />
            <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>New signups only</span>
          </label>
          <div style={{ marginTop: '.75rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" type="button" disabled={busyId === 'global-codes'} onClick={() => void createDynamicGlobalCode()}>
              Create Dynamic Global Code
            </button>
          </div>
        </article>

        <article className="glass-card" style={{ padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Global Redeem Codes</h3>
          {globalCodes.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No global codes.</p>
          ) : (
            <div style={{ display: 'grid', gap: '.4rem' }}>
              {globalCodes.slice(0, 10).map((codeItem) => (
                <div
                  key={codeItem.id}
                  className="glass-card"
                  style={{ padding: '.5rem .6rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}
                >
                  <div>
                    <strong style={{ fontFamily: 'monospace' }}>{codeItem.code}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
                      {codeItem.type === 'PERCENT' ? `${codeItem.percentOff}% off` : `${codeItem.freePeriodDays} free days`} ·
                      {' '}Used {codeItem.redemptionCount} times · {codeItem.active ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <button className="btn btn-ghost" type="button" onClick={() => void navigator.clipboard.writeText(codeItem.code)}>
                      Copy
                    </button>
                    {codeItem.active ? (
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busyId === codeItem.code}
                        onClick={() => void disableCode(codeItem.code, null)}
                      >
                        Disable
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <article className="glass-card" style={{ padding: '1rem' }}>
          {loading ? (
            <p>Loading clients...</p>
          ) : clients.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No clients found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '.7rem' }}>
              {clients.map((client) => (
                <div key={client.id} className="glass-card" style={{ padding: '.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{client.name}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                        {client.type} · {client.status} · Plan: {client.subscription?.planCode ?? '-'} · Billing:{' '}
                        {client.subscription?.billingStatus ?? '-'} · Trial left: {client.subscription?.trialDaysLeft ?? 0} days
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: '.84rem' }}>
                        Admins: {client.adminEmails.length > 0 ? client.adminEmails.join(', ') : '-'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-ghost" type="button" disabled={busyId === client.id} onClick={() => void openDetails(client.id)}>
                        Details
                      </button>
                      <button className="btn btn-primary" type="button" disabled={busyId === client.id} onClick={() => void extendTrial(client, 30)}>
                        +30 Trial
                      </button>
                      <button className="btn btn-ghost" type="button" disabled={busyId === client.id} onClick={() => void grantFreePeriod(client, 30)}>
                        +30 Free
                      </button>
                      <button className="btn btn-ghost" type="button" disabled={busyId === client.id} onClick={() => void toggleFreeAccess(client, true)}>
                        Free ON
                      </button>
                      <button className="btn btn-ghost" type="button" disabled={busyId === client.id} onClick={() => void toggleFreeAccess(client, false)}>
                        Free OFF
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busyId === client.id}
                        onClick={() => void createClientCode(client, { type: 'PERCENT', percentOff: 100, maxPerClient: 1 })}
                      >
                        Client 100%
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busyId === client.id}
                        onClick={() => void createClientCode(client, { type: 'PERCENT', percentOff: 40, maxPerClient: 1 })}
                      >
                        Client 40%
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        disabled={busyId === client.id}
                        onClick={() => void createClientCode(client, { type: 'FREE_PERIOD', freePeriodDays: 30, maxPerClient: 1 })}
                      >
                        Client 30 Days
                      </button>
                    </div>
                  </div>
                  {client.redeemCodes.length > 0 ? (
                    <div style={{ display: 'grid', gap: '.4rem', marginTop: '.6rem' }}>
                      {client.redeemCodes.slice(0, 5).map((codeItem) => (
                        <div
                          key={`${client.id}-${codeItem.code}`}
                          className="glass-card"
                          style={{ padding: '.5rem .6rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}
                        >
                          <div>
                            <strong style={{ fontFamily: 'monospace' }}>{codeItem.code}</strong>
                            <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
                              {codeItem.type === 'PERCENT' ? `${codeItem.percentOff}% off` : `${codeItem.freePeriodDays} free days`} ·
                              {' '}Used {codeItem.redemptionCount} · {codeItem.active ? 'Active' : 'Disabled'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <button className="btn btn-ghost" type="button" onClick={() => void navigator.clipboard.writeText(codeItem.code)}>
                              Copy
                            </button>
                            {codeItem.active ? (
                              <button
                                className="btn btn-ghost"
                                type="button"
                                disabled={busyId === codeItem.code}
                                onClick={() => void disableCode(codeItem.code, client.id)}
                              >
                                Disable
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {detailsClientId ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,.55)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 80
          }}
          onClick={closeDetails}
        >
          <aside
            className="glass-card"
            style={{
              width: 'min(760px, 100%)',
              height: '100%',
              overflow: 'auto',
              padding: '1rem',
              borderRadius: 0
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Client Details</p>
                <h2 style={{ margin: '.2rem 0 .3rem' }}>{details?.organization.name ?? detailsClientId}</h2>
              </div>
              <button className="btn btn-ghost" type="button" onClick={closeDetails}>
                Close
              </button>
            </div>
            {detailsLoading ? (
              <p>Loading details...</p>
            ) : !details ? (
              <p style={{ color: 'var(--muted)' }}>No details available.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <article className="glass-card" style={{ padding: '.8rem' }}>
                  <h3 style={{ marginTop: 0 }}>Organization</h3>
                  <div className="chip-row">
                    <span className="chip">Type: {details.organization.type}</span>
                    <span className="chip">Status: {details.organization.status}</span>
                    <span className="chip">Plan: {details.organization.subscription?.planCode ?? '-'}</span>
                    <span className="chip">Billing: {details.organization.subscription?.billingStatus ?? '-'}</span>
                  </div>
                </article>
                <article className="glass-card" style={{ padding: '.8rem' }}>
                  <h3 style={{ marginTop: 0 }}>Redeem Usage ({details.redeemUsages.length})</h3>
                  {details.redeemUsages.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>No redemptions yet.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '.45rem' }}>
                      {details.redeemUsages.map((item) => (
                        <div key={item.id} className="glass-card" style={{ padding: '.55rem' }}>
                          <strong>{item.redeemCode.code}</strong>
                          <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                            {item.redeemCode.type} · {new Date(item.usedAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </main>
  );
}
