export default function HomePage(): JSX.Element {
  return (
    <main style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      <h1>Quiz Platform Dashboard Shell</h1>
      <p>Heroku-first multi-tenant SaaS foundation is initialized.</p>
      <ul>
        <li>API base URL: <code>/api/v1</code></li>
        <li>Health check: <code>/api/v1/health</code></li>
        <li>Next steps: auth, tenant middleware, quiz modules</li>
      </ul>
    </main>
  );
}
