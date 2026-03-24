import Link from 'next/link';

const VALUE_POINTS = [
  {
    title: 'Why teams switch to QuizOS',
    items: [
      'Replace disconnected tools with one platform for school and publisher workflows',
      'Launch quizzes faster with reusable templates and role-based approval flow',
      'Distribute instantly via class assignment, secure links, or embedded experiences',
      'Measure what matters: starts, completions, pass rate, CTA clicks, and conversions'
    ]
  },
  {
    title: 'What you unlock',
    items: [
      'Professional quiz builder with branding, media, and dynamic start/end blocks',
      'School mode with classes, teacher controls, assignments, and leaderboard insights',
      'Publisher mode with embeds, lead capture, CTA blocks, and conversion tracking',
      'Multi-tenant admin with organization-level visibility, invitations, and access control'
    ]
  }
];

const MODULES = [
  {
    title: 'School Performance Suite',
    description: 'Organize classes, assign assessments, monitor student progress, and benchmark outcomes across schools.'
  },
  {
    title: 'Publisher Engagement Engine',
    description: 'Ship interactive quizzes, embed across websites, and turn audience engagement into qualified leads.'
  },
  {
    title: 'Tenant Admin Control Center',
    description: 'Run multiple organizations with secure isolation, governance controls, invitation workflows, and visibility.'
  }
];

const WORKFLOW = [
  {
    step: '01',
    title: 'Design',
    text: 'Build conversion-ready quizzes with themes, media, and custom intro/outro experiences.'
  },
  {
    step: '02',
    title: 'Distribute',
    text: 'Assign to classes, publish via secure links, or embed across your external websites.'
  },
  {
    step: '03',
    title: 'Optimize',
    text: 'Use analytics and conversion signals to improve outcomes and grow engagement.'
  }
];

const AUDIENCE = [
  {
    title: 'For Schools',
    points: ['Teacher assignments by class/student', 'Student dashboards and attempts', 'Performance and leaderboard visibility']
  },
  {
    title: 'For Publishers',
    points: ['Embed quizzes on websites', 'Capture leads with end-form blocks', 'Track conversions and drop-off']
  },
  {
    title: 'For Multi-Org Teams',
    points: ['Manage multiple tenants in one account', 'Invite by role and organization scope', 'Centralized admin and governance']
  }
];

const FEATURE_ROWS = [
  {
    feature: 'Quiz Builder',
    school: 'Draft, publish, assign by class',
    publisher: 'Create campaigns and brand flows'
  },
  {
    feature: 'Distribution',
    school: 'Student/class/school scope',
    publisher: 'Public link + iframe embed'
  },
  {
    feature: 'End Screens',
    school: 'Score and learning follow-up',
    publisher: 'CTA, form, redirect, article blocks'
  },
  {
    feature: 'Analytics',
    school: 'Scores, completion, performance',
    publisher: 'Views, starts, conversion funnel'
  },
  {
    feature: 'Access & Security',
    school: 'Role-based admin controls',
    publisher: 'Domain + access restrictions'
  }
];

const FAQ = [
  {
    q: 'Is this two separate products?',
    a: 'No. It is one shared core platform with different operational modes for schools and publishers.'
  },
  {
    q: 'Can I create multiple organizations?',
    a: 'Yes. You can create and manage multiple organizations and switch workspaces from one account.'
  },
  {
    q: 'Can quizzes be private and public?',
    a: 'Yes. You can run private class assignments, secure public links, and embedded public experiences.'
  },
  {
    q: 'Do you support lead capture?',
    a: 'Yes. End-of-quiz forms capture name/email/phone and custom fields for campaign conversion.'
  }
];

const PRICING = [
  {
    product: 'School Quiz Platform',
    plans: [
      { name: 'Starter', price: '$19/mo', desc: 'Small schools and pilot classes' },
      { name: 'Growth', price: '$59/mo', desc: 'Multiple classes and teacher workflows' },
      { name: 'Pro', price: '$129/mo', desc: 'Full operations and advanced analytics' }
    ]
  },
  {
    product: 'Publisher Engagement Platform',
    plans: [
      { name: 'Starter', price: '$29/mo', desc: 'Low-volume quiz campaigns' },
      { name: 'Growth', price: '$99/mo', desc: 'Embeds, lead capture, conversion tracking' },
      { name: 'Pro', price: '$199/mo', desc: 'High-volume media and enterprise scale' }
    ]
  }
];

const PRODUCT_SCREENS = [
  {
    title: 'Admin Dashboard',
    subtitle: 'Organization switcher, invites, and tenant controls',
    src: '/screens/admin-dashboard.svg'
  },
  {
    title: 'Quiz Builder',
    subtitle: 'Question flow, design settings, and start/end experiences',
    src: '/screens/quiz-builder.svg'
  },
  {
    title: 'Public Quiz Player',
    subtitle: 'Branded play view with conversion-ready end forms',
    src: '/screens/public-player.svg'
  }
];

export default function HomePage(): JSX.Element {
  return (
    <main className="landing-shell">
      <header className="container" style={{ padding: '1rem 0 .4rem' }}>
        <div className="landing-nav">
          <div className="landing-brand">QuizOS</div>
          <nav className="landing-nav-links">
            <a href="#why">Why QuizOS</a>
            <a href="#audience">Who It&apos;s For</a>
            <a href="#offers">What We Offer</a>
            <a href="#pricing">Pricing</a>
            <a href="#features">Features</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="landing-actions">
            <Link href="/login" className="btn btn-ghost">Login</Link>
            <Link href="/register" className="btn btn-primary">Start Free</Link>
          </div>
        </div>
      </header>

      <section className="container landing-hero">
        <div className="landing-hero-grid">
          <div>
            <span className="landing-pill">Built for schools, publishers, and multi-org teams</span>
            <h1 className="landing-title">
              Create high-performing quizzes that educate, engage, and convert.
            </h1>
            <p className="landing-subtitle">
              QuizOS combines classroom assessment, public quiz campaigns, and lead generation in one secure multi-tenant platform.
              Launch faster, track deeper, and scale without product fragmentation.
            </p>
            <div className="landing-actions-row">
              <Link href="/register" className="btn btn-primary">Start Free Workspace</Link>
              <Link href="/login" className="btn btn-ghost">Sign In</Link>
            </div>
            <div className="landing-proof">
              <span>No-code Quiz Builder</span>
              <span>Class + Public Distribution</span>
              <span>Lead & CTA Capture</span>
              <span>Secure Tenant Isolation</span>
            </div>
          </div>
          <aside className="landing-showcase">
            <div className="landing-showcase-head">
              <strong>Business Impact Snapshot</strong>
              <span>Representative platform metrics</span>
            </div>
            <div className="landing-metrics">
              <div><p>Active Organizations</p><strong>118</strong></div>
              <div><p>Monthly Quiz Attempts</p><strong>103k</strong></div>
              <div><p>Average Completion Rate</p><strong>68%</strong></div>
              <div><p>Lead Conversion Rate</p><strong>14.2%</strong></div>
            </div>
            <div className="landing-chart">
              <div className="landing-bar b1" />
              <div className="landing-bar b2" />
              <div className="landing-bar b3" />
              <div className="landing-bar b4" />
              <div className="landing-bar b5" />
            </div>
            <div className="landing-showcase-foot">
              <div>
                <p>Data Window</p>
                <strong>Last 30 Days</strong>
              </div>
              <div>
                <p>Best Performing Segment</p>
                <strong>Class Assignments</strong>
              </div>
              <div>
                <p>Tracking Coverage</p>
                <strong>Start → Completion → CTA</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="why" className="container section-band">
        <div className="landing-split">
          {VALUE_POINTS.map((group) => (
            <article key={group.title} className="glass-card landing-panel">
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="offers" className="container section-band">
        <h2 className="section-title">What We Offer</h2>
        <p className="section-lead">A complete product stack for assessment, engagement, and conversion.</p>
        <div className="feature-grid">
          {MODULES.map((module, idx) => (
            <article
              key={module.title}
              className={`glass-card ${idx === 0 ? 'tint-teal' : idx === 1 ? 'tint-amber' : 'tint-blue'}`}
              style={{ padding: '1rem' }}
            >
              <h3 style={{ marginTop: 0 }}>{module.title}</h3>
              <p style={{ color: 'var(--muted)', marginBottom: 0 }}>{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-band">
        <h2 className="section-title">Real Product Screens</h2>
        <p className="section-lead">
          These blocks are ready for your actual screenshots from your live admin and quiz pages.
        </p>
        <div className="landing-screen-grid">
          {PRODUCT_SCREENS.map((screen) => (
            <article key={screen.title} className="glass-card landing-screen-card">
              <img src={screen.src} alt={screen.title} />
              <div className="landing-screen-meta">
                <strong>{screen.title}</strong>
                <p>{screen.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="audience" className="container section-band">
        <h2 className="section-title">Who It&apos;s For</h2>
        <p className="section-lead">Clear fit by use case, from classrooms to media campaigns.</p>
        <div className="landing-audience-grid">
          {AUDIENCE.map((group, idx) => (
            <article
              key={group.title}
              className={`glass-card ${idx === 0 ? 'tint-teal' : idx === 1 ? 'tint-amber' : 'tint-blue'}`}
              style={{ padding: '1rem' }}
            >
              <h3 style={{ marginTop: 0 }}>{group.title}</h3>
              <ul className="landing-mini-list">
                {group.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="container section-band">
        <h2 className="section-title">How It Works</h2>
        <p className="section-lead">From creation to impact in three clear stages.</p>
        <div className="landing-workflow">
          {WORKFLOW.map((item) => (
            <article key={item.step} className="landing-work-item">
              <span className="landing-step">{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="features" className="container section-band">
        <h2 className="section-title">Feature Breakdown</h2>
        <p className="section-lead">See exactly how each mode works before you start.</p>
        <div className="glass-card" style={{ padding: '1rem' }}>
          <div className="landing-feature-header">
            <strong>Capability</strong>
            <strong>School Mode</strong>
            <strong>Publisher Mode</strong>
          </div>
          <div className="landing-feature-table">
            {FEATURE_ROWS.map((row) => (
              <div key={row.feature} className="landing-feature-row">
                <span>{row.feature}</span>
                <span>{row.school}</span>
                <span>{row.publisher}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="container section-band">
        <h2 className="section-title">Pricing</h2>
        <p className="section-lead">
          Start with a full-feature 30-day free trial. After trial, activate payment to continue.
        </p>
        <div className="landing-pricing-grid">
          {PRICING.map((block) => (
            <article key={block.product} className="glass-card" style={{ padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{block.product}</h3>
              <div className="landing-pricing-plans">
                {block.plans.map((plan) => (
                  <div key={`${block.product}-${plan.name}`} className="landing-price-card">
                    <p className="landing-price-name">{plan.name}</p>
                    <strong className="landing-price-value">{plan.price}</strong>
                    <p className="landing-price-desc">{plan.desc}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container section-band">
        <div className="landing-security">
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Security and Compliance Ready</h3>
            <ul className="landing-mini-list">
              <li>Organization-level tenant isolation and membership checks</li>
              <li>Role-based access control for admins, teachers, editors, and students</li>
              <li>Audit-friendly operational model for critical content actions</li>
            </ul>
          </article>
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>What Happens After Signup</h3>
            <ul className="landing-mini-list">
              <li>Create organization and choose type (school/publisher/company)</li>
              <li>Invite users and assign role permissions</li>
              <li>Create first quiz and publish with assignment or public access</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="faq" className="container section-band">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <div className="landing-faq-grid">
          {FAQ.map((item) => (
            <article key={item.q} className="glass-card" style={{ padding: '1rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '.35rem' }}>{item.q}</h4>
              <p style={{ margin: 0, color: 'var(--muted)' }}>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '.8rem 0 2.2rem' }}>
        <div className="glass-card landing-cta">
          <h2>Ready to launch and scale your quiz business?</h2>
          <p>Start free now, onboard your first organization, and grow into a multi-tenant quiz SaaS with confidence.</p>
          <div className="landing-actions-row" style={{ justifyContent: 'center' }}>
            <Link href="/register" className="btn btn-primary">Create Free Account</Link>
            <Link href="/login" className="btn btn-ghost">Go to Login</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
