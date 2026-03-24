'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

interface EmbedSettings {
  quizId: string;
  embedSettings: {
    enabled: boolean;
    allowlistDomains: string[];
  };
}

interface LeadWebhook {
  quizId: string;
  leadWebhook: {
    enabled: boolean;
    url: string;
  };
}

export default function QuizPublisherSettingsPage(): JSX.Element {
  const params = useParams<{ orgId: string; quizId: string }>();
  const router = useRouter();
  const orgId = params.orgId;
  const quizId = params.quizId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [embedEnabled, setEmbedEnabled] = useState(false);
  const [allowlist, setAllowlist] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');

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
      const [embedRes, webhookRes] = await Promise.all([
        fetch(`${API_BASE}/quizzes/${quizId}/embed-settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        }),
        fetch(`${API_BASE}/quizzes/${quizId}/lead-webhook`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        })
      ]);

      const embedPayload = (await embedRes.json()) as EmbedSettings | { message?: string };
      const webhookPayload = (await webhookRes.json()) as LeadWebhook | { message?: string };

      if (embedRes.ok && 'embedSettings' in embedPayload) {
        setEmbedEnabled(embedPayload.embedSettings.enabled);
        setAllowlist(embedPayload.embedSettings.allowlistDomains.join('\n'));
      }
      if (webhookRes.ok && 'leadWebhook' in webhookPayload) {
        setWebhookEnabled(webhookPayload.leadWebhook.enabled);
        setWebhookUrl(webhookPayload.leadWebhook.url);
      }
    } catch {
      setError('Unable to load publisher settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveEmbed(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/embed-settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: embedEnabled,
          allowlistDomains: allowlist
            .split(/\n|,/g)
            .map((value) => value.trim())
            .filter(Boolean)
        })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to save embed settings');
        return;
      }
      setSuccess('Embed settings saved');
    } finally {
      setBusy(false);
    }
  }

  async function saveWebhook(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/lead-webhook`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: webhookEnabled,
          url: webhookUrl.trim() || undefined
        })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to save webhook settings');
        return;
      }
      setSuccess('Lead webhook settings saved');
    } finally {
      setBusy(false);
    }
  }

  async function exportLeads(): Promise<void> {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    const response = await fetch(`${API_BASE}/quizzes/${quizId}/end-form/submissions/export`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-organization-id': orgId
      }
    });
    const payload = (await response.json()) as { filename?: string; csv?: string; message?: string };
    if (!response.ok || !payload.csv) {
      setError(payload.message ?? 'Unable to export leads');
      return;
    }
    const blob = new Blob([payload.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = payload.filename ?? `quiz-${quizId}-leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem' }}>
          <h1 style={{ marginTop: 0 }}>Publisher Settings</h1>
          <p style={{ color: 'var(--muted)' }}>
            Manage embed domain allowlist, lead export, and webhook delivery stub.
          </p>
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.8rem' }}>
            <Link href={`/dashboard/workspace/${orgId}/quizzes/${quizId}/builder`} className="btn btn-ghost">
              Back to Builder
            </Link>
            <button className="btn btn-ghost" type="button" onClick={() => void exportLeads()}>
              Export Leads CSV
            </button>
          </div>
          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
          {loading ? (
            <p>Loading settings...</p>
          ) : (
            <div className="feature-grid">
              <article className="glass-card" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Embed Allowlist</h3>
                <form onSubmit={saveEmbed}>
                  <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.7rem' }}>
                    <input type="checkbox" checked={embedEnabled} onChange={(event) => setEmbedEnabled(event.target.checked)} />
                    Enable embed domain restrictions
                  </label>
                  <div className="field">
                    <label htmlFor="allowlist">Allowed domains (one per line)</label>
                    <textarea
                      id="allowlist"
                      value={allowlist}
                      onChange={(event) => setAllowlist(event.target.value)}
                      rows={6}
                      placeholder={'example.com\nnews.example.com'}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    Save Embed Settings
                  </button>
                </form>
              </article>

              <article className="glass-card" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Lead Webhook (Stub)</h3>
                <form onSubmit={saveWebhook}>
                  <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.7rem' }}>
                    <input
                      type="checkbox"
                      checked={webhookEnabled}
                      onChange={(event) => setWebhookEnabled(event.target.checked)}
                    />
                    Enable webhook queue logging
                  </label>
                  <div className="field">
                    <label htmlFor="webhook">Webhook URL</label>
                    <input
                      id="webhook"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      placeholder="https://hooks.example.com/quiz-leads"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    Save Webhook
                  </button>
                </form>
              </article>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
