'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface AssignmentRequestItem {
  id: string;
  name: string;
  email: string;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedNote?: string | null;
  assignmentId: string;
  quizId: string;
  quiz?: {
    id: string;
    title: string;
  };
}

interface BillingStatus {
  paymentRequired: boolean;
}

export default function AssignmentRequestsInboxPage(): JSX.Element {
  const params = useParams<{ orgId: string }>();
  const router = useRouter();
  const orgId = params.orgId;

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<AssignmentRequestItem[]>([]);
  const [status, setStatus] = useState<RequestStatus>('PENDING');
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    void load();
  }, [orgId, status]);

  async function load(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [response, billingRes] = await Promise.all([
        fetch(`${API_BASE}/quizzes/assignment-requests/inbox?status=${status}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        }),
        fetch(`${API_BASE}/organizations/current/billing`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        })
      ]);
      const payload = (await response.json()) as AssignmentRequestItem[] | { message?: string };
      const billingPayload = (await billingRes.json()) as BillingStatus | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        setError('Unable to load assignment requests');
        setRequests([]);
        return;
      }
      setRequests(payload);
      setBilling(billingRes.ok && 'paymentRequired' in billingPayload ? billingPayload as BillingStatus : null);
    } catch {
      setError('Unable to load assignment requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  async function review(item: AssignmentRequestItem, approve: boolean): Promise<void> {
    if (billing?.paymentRequired) {
      setError('Feature locked: trial expired. Activate billing to review requests.');
      return;
    }
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setBusyId(item.id);
    setError(null);
    try {
      const action = approve ? 'approve' : 'reject';
      const response = await fetch(
        `${API_BASE}/quizzes/${item.quizId}/assignments/${item.assignmentId}/requests/${item.id}/${action}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to review request');
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h1 style={{ marginTop: 0 }}>Assignment Request Inbox</h1>
          <p style={{ color: 'var(--muted)' }}>
            Review access requests from request-link assignments across this organization.
          </p>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap', marginBottom: '.8rem' }}>
            {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((item) => (
              <button
                key={item}
                className="btn btn-ghost"
                type="button"
                onClick={() => setStatus(item)}
                style={{
                  borderColor: status === item ? '#0f766e' : undefined,
                  color: status === item ? '#0f766e' : undefined
                }}
              >
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem' }}>
            <Link href={`/dashboard/workspace/${orgId}`} className="btn btn-ghost">
              Back
            </Link>
          </div>
          {billing?.paymentRequired ? (
            <p style={{ color: '#b45309' }}>
              Feature locked: trial expired. Activate billing to approve or reject assignment requests.
            </p>
          ) : null}
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {loading ? (
            <p>Loading requests...</p>
          ) : requests.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No {status.toLowerCase()} requests.</p>
          ) : (
            <div style={{ display: 'grid', gap: '.6rem' }}>
              {requests.map((item) => (
                <div key={item.id} className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>{item.name}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>{item.email}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                        Quiz: {item.quiz?.title ?? item.quizId} · Requested: {new Date(item.requestedAt).toLocaleString()}
                      </div>
                      {item.reviewedAt ? (
                        <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                          Reviewed: {new Date(item.reviewedAt).toLocaleString()}
                        </div>
                      ) : null}
                    </div>
                    {item.status === 'PENDING' ? (
                      <div style={{ display: 'flex', gap: '.4rem' }}>
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={() => void review(item, true)}
                          disabled={busyId === item.id || Boolean(billing?.paymentRequired)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => void review(item, false)}
                          disabled={busyId === item.id || Boolean(billing?.paymentRequired)}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="chip">{item.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
