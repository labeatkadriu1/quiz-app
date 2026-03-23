import Link from 'next/link';

export default function HomePage(): JSX.Element {
  return (
    <main>
      <header className="container" style={{ padding: '1rem 0' }}>
        <div
          className="glass-card"
          style={{
            padding: '0.85rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontWeight: 800, fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            QuizOS
          </div>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <Link href="/login" className="btn btn-ghost">
              Login
            </Link>
            <Link href="/register" className="btn btn-primary">
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <section className="container" style={{ padding: '1rem 0 1.2rem' }}>
        <div className="hero-grid">
          <div>
            <p
              style={{
                display: 'inline-block',
                padding: '.3rem .6rem',
                borderRadius: 999,
                border: '1px solid var(--line)',
                background: 'rgba(255,255,255,.75)',
                fontSize: '.82rem',
                marginBottom: '.7rem'
              }}
            >
              Multi-tenant quiz SaaS for schools and publishers
            </p>
            <h1
              style={{
                fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif',
                fontSize: 'clamp(2rem,5vw,3.6rem)',
                lineHeight: 1.04,
                margin: 0
              }}
            >
              Launch quizzes that teach, rank, convert and scale.
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '1.07rem', maxWidth: 650 }}>
              One platform for classrooms and content teams. Build quizzes, assign by class, embed on any
              site, track performance, capture leads, and manage every organization from one secure SaaS core.
            </p>
            <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap', marginTop: '.8rem' }}>
              <Link href="/register" className="btn btn-primary">
                Create Workspace
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Sign In
              </Link>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1rem' }}>
            <div
              style={{
                borderRadius: 16,
                padding: '1rem',
                background:
                  'linear-gradient(135deg, rgba(15,118,110,.12), rgba(245,158,11,.14)), rgba(255,255,255,.8)',
                border: '1px solid var(--line)'
              }}
            >
              <h3 style={{ marginTop: 0 }}>Live Product Snapshot</h3>
              <div className="stats-grid">
                <div className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Organizations</div>
                  <strong>1,240</strong>
                </div>
                <div className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Monthly Attempts</div>
                  <strong>2.9M</strong>
                </div>
                <div className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Completion Rate</div>
                  <strong>71%</strong>
                </div>
                <div className="glass-card" style={{ padding: '.7rem' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Lead Conversion</div>
                  <strong>18.4%</strong>
                </div>
              </div>
              <div style={{ marginTop: '.8rem', color: 'var(--muted)', fontSize: '.9rem' }}>
                Includes assignment engine, school leaderboard, publisher embeds, CTA forms, and event analytics.
              </div>
              <svg
                viewBox="0 0 640 220"
                style={{
                  width: '100%',
                  marginTop: '.9rem',
                  borderRadius: 14,
                  border: '1px solid var(--line)',
                  background: 'rgba(255,255,255,.88)'
                }}
                role="img"
                aria-label="Quiz analytics preview"
              >
                <rect x="0" y="0" width="640" height="220" fill="url(#bg)" />
                <defs>
                  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ecfeff" />
                    <stop offset="100%" stopColor="#fef3c7" />
                  </linearGradient>
                </defs>
                <rect x="20" y="20" width="250" height="180" rx="12" fill="#ffffff" stroke="#d1d5db" />
                <rect x="290" y="20" width="330" height="82" rx="12" fill="#ffffff" stroke="#d1d5db" />
                <rect x="290" y="118" width="155" height="82" rx="12" fill="#ffffff" stroke="#d1d5db" />
                <rect x="465" y="118" width="155" height="82" rx="12" fill="#ffffff" stroke="#d1d5db" />
                <rect x="38" y="45" width="54" height="8" rx="4" fill="#0f766e" />
                <rect x="38" y="63" width="145" height="8" rx="4" fill="#e5e7eb" />
                <rect x="38" y="84" width="210" height="8" rx="4" fill="#e5e7eb" />
                <rect x="38" y="105" width="175" height="8" rx="4" fill="#e5e7eb" />
                <rect x="38" y="129" width="190" height="8" rx="4" fill="#e5e7eb" />
                <rect x="38" y="150" width="90" height="28" rx="8" fill="#115e59" />
                <circle cx="315" cy="62" r="16" fill="#f59e0b" />
                <rect x="340" y="45" width="160" height="8" rx="4" fill="#e5e7eb" />
                <rect x="340" y="62" width="220" height="8" rx="4" fill="#e5e7eb" />
                <rect x="340" y="79" width="135" height="8" rx="4" fill="#e5e7eb" />
                <rect x="309" y="142" width="116" height="9" rx="4.5" fill="#0f766e" />
                <rect x="309" y="159" width="82" height="9" rx="4.5" fill="#e5e7eb" />
                <rect x="484" y="142" width="116" height="9" rx="4.5" fill="#0f766e" />
                <rect x="484" y="159" width="82" height="9" rx="4.5" fill="#e5e7eb" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '.7rem 0 1.5rem' }}>
        <h2 className="section-title">Built For Two Powerful Modes</h2>
        <p className="section-lead">
          Run classroom assessments and media engagement campaigns from one shared SaaS core.
        </p>
        <div className="feature-grid">
          <article className="glass-card tint-teal" style={{ padding: '1rem' }}>
            <h3>School Mode</h3>
            <p style={{ color: 'var(--muted)' }}>
              Teacher assignments, class groups, student attempts, score tracking, pass thresholds, and school-level
              ranking.
            </p>
            <div className="chip-row">
              <span className="chip">Class Management</span>
              <span className="chip">Teacher Workflows</span>
              <span className="chip">Student Portals</span>
            </div>
          </article>
          <article className="glass-card tint-amber" style={{ padding: '1rem' }}>
            <h3>Publisher Mode</h3>
            <p style={{ color: 'var(--muted)' }}>
              Publish and embed quizzes, set end-screen CTA/forms, collect leads, and optimize funnels with drop-off
              analytics.
            </p>
            <div className="chip-row">
              <span className="chip">Iframe Embed</span>
              <span className="chip">Lead Forms</span>
              <span className="chip">Conversion Events</span>
            </div>
          </article>
          <article className="glass-card tint-blue" style={{ padding: '1rem' }}>
            <h3>Shared Core SaaS</h3>
            <p style={{ color: 'var(--muted)' }}>
              Multi-tenant architecture, RBAC, subscriptions, audit logs, and a unified admin layer for scale.
            </p>
            <div className="chip-row">
              <span className="chip">Tenant Isolation</span>
              <span className="chip">Role Permissions</span>
              <span className="chip">Audit Trails</span>
            </div>
          </article>
        </div>
      </section>

      <section className="container section-band">
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>What your team can do</h3>
            <ul style={{ margin: 0, color: 'var(--muted)', paddingLeft: '1rem' }}>
              <li>Create and publish quizzes with draft workflows</li>
              <li>Assign quizzes by student, class, school or public link</li>
              <li>Track attempts, scores, pass rates and leaderboard ranking</li>
              <li>Customize end screens with CTA, forms and redirects</li>
            </ul>
          </article>
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Platform architecture</h3>
            <ul style={{ margin: 0, color: 'var(--muted)', paddingLeft: '1rem' }}>
              <li>Next.js frontend, NestJS API, PostgreSQL transactional core</li>
              <li>Redis cache + queue for workers and fast leaderboard reads</li>
              <li>Event-based analytics with expansion path to ClickHouse</li>
              <li>Built for Heroku-first deployment and future cloud migration</li>
            </ul>
          </article>
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Security and compliance</h3>
            <ul style={{ margin: 0, color: 'var(--muted)', paddingLeft: '1rem' }}>
              <li>Per-organization data boundaries and strict membership checks</li>
              <li>JWT auth, server-side validation, and rate limiting controls</li>
              <li>Audit log strategy for admin and content actions</li>
              <li>Design ready for GDPR/COPPA controls and PII governance</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="container section-band">
        <h2 className="section-title">Product Visual Showcase</h2>
        <p className="section-lead">More than text: this is how your SaaS experience can look inside the platform.</p>
        <div className="showcase-grid">
          <article className="glass-card tint-blue" style={{ padding: '1rem' }}>
            <svg viewBox="0 0 760 320" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }}>
              <rect x="0" y="0" width="760" height="320" fill="#f8fafc" />
              <rect x="16" y="16" width="170" height="288" rx="12" fill="#ffffff" stroke="#d1d5db" />
              <rect x="202" y="16" width="542" height="70" rx="12" fill="#ffffff" stroke="#d1d5db" />
              <rect x="202" y="98" width="260" height="206" rx="12" fill="#ffffff" stroke="#d1d5db" />
              <rect x="478" y="98" width="266" height="98" rx="12" fill="#ffffff" stroke="#d1d5db" />
              <rect x="478" y="206" width="266" height="98" rx="12" fill="#ffffff" stroke="#d1d5db" />
              <rect x="34" y="38" width="130" height="10" rx="5" fill="#0f766e" />
              <rect x="34" y="60" width="108" height="8" rx="4" fill="#e5e7eb" />
              <rect x="34" y="79" width="118" height="8" rx="4" fill="#e5e7eb" />
              <rect x="34" y="98" width="90" height="8" rx="4" fill="#e5e7eb" />
              <rect x="225" y="36" width="130" height="10" rx="5" fill="#f59e0b" />
              <rect x="225" y="56" width="240" height="8" rx="4" fill="#e5e7eb" />
              <rect x="225" y="116" width="220" height="10" rx="5" fill="#0f766e" />
              <rect x="225" y="134" width="180" height="8" rx="4" fill="#e5e7eb" />
              <rect x="225" y="150" width="210" height="8" rx="4" fill="#e5e7eb" />
              <rect x="500" y="120" width="220" height="8" rx="4" fill="#e5e7eb" />
              <rect x="500" y="137" width="180" height="8" rx="4" fill="#e5e7eb" />
              <rect x="500" y="230" width="220" height="8" rx="4" fill="#e5e7eb" />
              <rect x="500" y="247" width="170" height="8" rx="4" fill="#e5e7eb" />
            </svg>
            <div className="visual-label">School dashboard: classes, assignments, and performance cards.</div>
          </article>

          <div className="mini-grid">
            <article className="glass-card tint-amber" style={{ padding: '1rem' }}>
              <svg viewBox="0 0 440 150" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }}>
                <rect width="440" height="150" fill="#fff7ed" />
                <rect x="14" y="14" width="265" height="122" rx="10" fill="#ffffff" stroke="#d1d5db" />
                <rect x="292" y="14" width="134" height="57" rx="10" fill="#ffffff" stroke="#d1d5db" />
                <rect x="292" y="79" width="134" height="57" rx="10" fill="#ffffff" stroke="#d1d5db" />
                <rect x="28" y="34" width="98" height="8" rx="4" fill="#f59e0b" />
                <rect x="28" y="50" width="225" height="8" rx="4" fill="#e5e7eb" />
                <rect x="28" y="66" width="195" height="8" rx="4" fill="#e5e7eb" />
                <rect x="28" y="90" width="72" height="24" rx="7" fill="#115e59" />
              </svg>
              <div className="visual-label">Publisher embed panel with CTA configuration.</div>
            </article>

            <article className="glass-card tint-teal" style={{ padding: '1rem' }}>
              <svg viewBox="0 0 440 150" style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }}>
                <rect width="440" height="150" fill="#ecfeff" />
                <polyline
                  points="24,120 80,92 130,105 190,70 250,80 310,54 360,63 416,34"
                  fill="none"
                  stroke="#0f766e"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <circle cx="80" cy="92" r="5" fill="#0f766e" />
                <circle cx="190" cy="70" r="5" fill="#0f766e" />
                <circle cx="310" cy="54" r="5" fill="#0f766e" />
                <rect x="20" y="16" width="120" height="10" rx="5" fill="#0f766e" />
                <rect x="20" y="32" width="180" height="8" rx="4" fill="#cbd5e1" />
              </svg>
              <div className="visual-label">Analytics funnel: starts, completion, drop-off, conversion.</div>
            </article>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '.6rem 0 2.3rem' }}>
        <div className="glass-card" style={{ padding: '1rem', textAlign: 'center' }}>
          <h2 style={{ fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif', marginBottom: '.4rem' }}>
            Ready to launch your quiz SaaS?
          </h2>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Start with one organization and scale to schools, media brands, and enterprise clients.
          </p>
          <div style={{ display: 'flex', gap: '.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary">
              Create Account
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
