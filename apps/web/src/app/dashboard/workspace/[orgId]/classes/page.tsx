'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface SchoolItem {
  id: string;
  name: string;
  timezone?: string | null;
}

interface ClassMembership {
  id: string;
  memberType: 'TEACHER' | 'STUDENT';
}

interface ClassItem {
  id: string;
  schoolId: string;
  name: string;
  code?: string | null;
  school?: SchoolItem;
  memberships?: ClassMembership[];
  joinRequests?: Array<{ id: string }>;
}

interface JoinRequestItem {
  id: string;
  email: string;
  requestedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string | null;
}

interface MemberItem {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
  role?: {
    key: string;
    name: string;
  } | null;
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

export default function WorkspaceClassesPage(): JSX.Element {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const orgId = params.orgId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [limits, setLimits] = useState<LimitsStatus | null>(null);

  const [schoolName, setSchoolName] = useState('');
  const [schoolTimezone, setSchoolTimezone] = useState('Europe/Belgrade');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [className, setClassName] = useState('');
  const [classCode, setClassCode] = useState('');

  const [teacherByClass, setTeacherByClass] = useState<Record<string, string>>({});
  const [joinUrlByClass, setJoinUrlByClass] = useState<Record<string, string>>({});
  const [joinRequestsByClass, setJoinRequestsByClass] = useState<Record<string, JoinRequestItem[]>>({});
  const [requestStatusByClass, setRequestStatusByClass] = useState<Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'>>({});

  const teacherCandidates = useMemo(
    () =>
      members.filter((member) => {
        const key = member.role?.key ?? '';
        return key.includes('TEACHER') || key.includes('ADMIN');
      }),
    [members]
  );

  useEffect(() => {
    void loadAll();
  }, [orgId]);

  function getTokenOrRedirect(): string | null {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return null;
    }
    return token;
  }

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    await Promise.all([loadSchools(), loadClasses(), loadMembers(), loadBilling()]);
    setLoading(false);
  }

  async function loadBilling(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
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
  }

  async function loadSchools(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    const response = await fetch(`${API_BASE}/classes/schools`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId
      }
    });
    const payload = (await response.json()) as SchoolItem[] | { message?: string };
    if (!response.ok || !Array.isArray(payload)) {
      return;
    }
    setSchools(payload);
    if (!selectedSchoolId && payload.length > 0) {
      setSelectedSchoolId(payload[0].id);
    }
  }

  async function loadClasses(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    const response = await fetch(`${API_BASE}/classes`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId
      }
    });
    const payload = (await response.json()) as ClassItem[] | { message?: string };
    if (!response.ok || !Array.isArray(payload)) {
      setError('Unable to load classes');
      return;
    }
    setClasses(payload);
  }

  async function loadMembers(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    const response = await fetch(`${API_BASE}/organizations/current/members`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId
      }
    });
    const payload = (await response.json()) as MemberItem[] | { message?: string };
    if (!response.ok || !Array.isArray(payload)) {
      return;
    }
    setMembers(payload);
  }

  async function createSchool(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to create schools.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    if (schoolName.trim().length < 2) {
      setError('School name must be at least 2 characters');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/classes/schools`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: schoolName.trim(),
          timezone: schoolTimezone.trim() || undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to create school');
        return;
      }
      setSuccess('School created');
      setSchoolName('');
      await loadSchools();
    } finally {
      setBusy(false);
    }
  }

  async function createClass(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to create classes.');
      return;
    }

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    if (!selectedSchoolId) {
      setError('Select a school first');
      return;
    }
    if (className.trim().length < 2) {
      setError('Class name must be at least 2 characters');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/classes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          schoolId: selectedSchoolId,
          name: className.trim(),
          code: classCode.trim() || undefined
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to create class');
        return;
      }
      setSuccess('Class created');
      setClassName('');
      setClassCode('');
      await loadClasses();
    } finally {
      setBusy(false);
    }
  }

  async function assignTeacher(classId: string): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to assign teachers.');
      return;
    }
    const teacherId = teacherByClass[classId];
    if (!teacherId) {
      setError('Select a teacher first');
      return;
    }
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/classes/${classId}/members`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: teacherId,
          memberType: 'TEACHER'
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to assign teacher');
        return;
      }
      setSuccess('Teacher assigned to class');
      await loadClasses();
    } finally {
      setBusy(false);
    }
  }

  async function createJoinLink(classId: string): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to create join links.');
      return;
    }
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/classes/${classId}/join-links`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { joinUrl?: string; message?: string };
      if (!response.ok || !payload.joinUrl) {
        setError(payload.message ?? 'Unable to create join link');
        return;
      }
      setJoinUrlByClass((prev) => ({ ...prev, [classId]: payload.joinUrl ?? '' }));
      setSuccess('Join link created');
    } finally {
      setBusy(false);
    }
  }

  async function loadJoinRequests(classId: string, status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    const activeStatus = status ?? requestStatusByClass[classId] ?? 'PENDING';
    const response = await fetch(`${API_BASE}/classes/${classId}/join-requests?status=${activeStatus}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId
      }
    });
    const payload = (await response.json()) as JoinRequestItem[] | { message?: string };
    if (!response.ok || !Array.isArray(payload)) {
      setError('Unable to load join requests');
      return;
    }
    setRequestStatusByClass((prev) => ({ ...prev, [classId]: activeStatus }));
    setJoinRequestsByClass((prev) => ({ ...prev, [classId]: payload }));
  }

  async function reviewJoinRequest(classId: string, requestId: string, approve: boolean): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to review class requests.');
      return;
    }
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/classes/join-requests/${requestId}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approve })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to review request');
        return;
      }
      setSuccess(approve ? 'Student approved and added to class' : 'Join request rejected');
      await Promise.all([loadClasses(), loadJoinRequests(classId, requestStatusByClass[classId] ?? 'PENDING')]);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url: string): Promise<void> {
    await navigator.clipboard.writeText(url);
    setSuccess('Join link copied');
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading classes...</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            Class Management
          </h1>
          <p style={{ color: 'var(--muted)' }}>
            Create schools/classes, assign teachers, generate join link/QR, approve student join requests.
          </p>
          <div className="chip-row">
            <span className="chip">Schools: {schools.length}</span>
            <span className="chip">Classes: {classes.length}</span>
            {limits ? <span className="chip">Members: {limits.usage.members}/{limits.limits.memberLimit}</span> : null}
          </div>
          {billing?.paymentRequired ? (
            <p style={{ color: '#b45309', marginTop: '.6rem' }}>
              Feature locked: trial expired. Activate billing to create classes, links, and approvals.
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
            <h3 style={{ marginTop: 0 }}>Create School</h3>
            <form onSubmit={createSchool}>
              <div className="field">
                <label htmlFor="schoolName">School name</label>
                <input id="schoolName" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="schoolTimezone">Timezone</label>
                <input
                  id="schoolTimezone"
                  value={schoolTimezone}
                  onChange={(event) => setSchoolTimezone(event.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || Boolean(billing?.paymentRequired)}>
                {busy ? 'Saving...' : 'Create School'}
              </button>
            </form>
          </article>

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Create Class</h3>
            <form onSubmit={createClass}>
              <div className="field">
                <label htmlFor="schoolSelect">School</label>
                <select
                  id="schoolSelect"
                  value={selectedSchoolId}
                  onChange={(event) => setSelectedSchoolId(event.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value="">Select school</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="className">Class name</label>
                <input id="className" value={className} onChange={(event) => setClassName(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="classCode">Class code</label>
                <input id="classCode" value={classCode} onChange={(event) => setClassCode(event.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy || Boolean(billing?.paymentRequired)}>
                {busy ? 'Saving...' : 'Create Class'}
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className="container" style={{ marginTop: '1rem' }}>
        <article className="glass-card" style={{ padding: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Class List</h3>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}

          {classes.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No classes yet. Create your first class above.</p>
          ) : (
            <div style={{ display: 'grid', gap: '.8rem' }}>
              {classes.map((item) => {
                const teacherCount = item.memberships?.filter((m) => m.memberType === 'TEACHER').length ?? 0;
                const studentCount = item.memberships?.filter((m) => m.memberType === 'STUDENT').length ?? 0;
                const pendingCount = item.joinRequests?.length ?? 0;
                const joinUrl = joinUrlByClass[item.id];
                const requests = joinRequestsByClass[item.id] ?? [];
                const activeStatus = requestStatusByClass[item.id] ?? 'PENDING';

                return (
                  <div key={item.id} className="glass-card" style={{ padding: '.7rem' }}>
                    <strong>{item.name}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>
                      School: {item.school?.name ?? item.schoolId} · Code: {item.code ?? '-'} · Teachers: {teacherCount} · Students:{' '}
                      {studentCount} · Pending: {pendingCount}
                    </div>

                    <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
                      <select
                        value={teacherByClass[item.id] ?? ''}
                        onChange={(event) => setTeacherByClass((prev) => ({ ...prev, [item.id]: event.target.value }))}
                        style={{
                          minWidth: 260,
                          border: '1px solid var(--line)',
                          borderRadius: 12,
                          padding: '0.55rem 0.65rem',
                          fontSize: '.92rem',
                          background: '#fff'
                        }}
                      >
                        <option value="">Select teacher/admin</option>
                        {teacherCandidates.map((candidate) => {
                          const label = [candidate.user.firstName, candidate.user.lastName].filter(Boolean).join(' ').trim();
                          return (
                            <option key={candidate.user.id} value={candidate.user.id}>
                              {label || candidate.user.email}
                            </option>
                          );
                        })}
                      </select>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => void assignTeacher(item.id)}
                        disabled={busy || Boolean(billing?.paymentRequired)}
                      >
                        Assign Teacher
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => void createJoinLink(item.id)}
                        disabled={busy || Boolean(billing?.paymentRequired)}
                      >
                        Create Join Link
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => void loadJoinRequests(item.id, activeStatus)}
                      >
                        Load Requests ({activeStatus.toLowerCase()})
                      </button>
                    </div>

                    {joinUrl ? (
                      <div className="glass-card" style={{ padding: '.6rem', marginTop: '.6rem' }}>
                        <p style={{ margin: 0, fontSize: '.82rem', color: 'var(--muted)' }}>Join URL</p>
                        <p style={{ margin: '.3rem 0', fontSize: '.78rem', wordBreak: 'break-all' }}>{joinUrl}</p>
                        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost" type="button" onClick={() => void copyLink(joinUrl)}>
                            Copy Link
                          </button>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(joinUrl)}`}
                            alt="Class join QR"
                            width={140}
                            height={140}
                            style={{ borderRadius: 10, border: '1px solid var(--line)', background: '#fff' }}
                          />
                        </div>
                      </div>
                    ) : null}

                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
                      {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                        <button
                          key={`${item.id}-${status}`}
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => void loadJoinRequests(item.id, status)}
                          style={{
                            borderColor: activeStatus === status ? '#0f766e' : undefined,
                            color: activeStatus === status ? '#0f766e' : undefined
                          }}
                        >
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>

                    {requests.length > 0 ? (
                      <div style={{ display: 'grid', gap: '.45rem', marginTop: '.6rem' }}>
                        {requests.map((request) => (
                          <div key={request.id} className="glass-card" style={{ padding: '.55rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
                              <div>
                                <strong>{request.email}</strong>
                                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                                  Requested: {new Date(request.requestedAt).toLocaleString()}
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Status: {request.status}</div>
                              </div>
                              {request.status === 'PENDING' ? (
                                <div style={{ display: 'flex', gap: '.4rem' }}>
                                  <button
                                    className="btn btn-primary"
                                    type="button"
                                    onClick={() => void reviewJoinRequest(item.id, request.id, true)}
                                    disabled={busy || Boolean(billing?.paymentRequired)}
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="btn btn-ghost"
                                    type="button"
                                    onClick={() => void reviewJoinRequest(item.id, request.id, false)}
                                    disabled={busy || Boolean(billing?.paymentRequired)}
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
