'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    const token = localStorage.getItem('quiz_access_token');
    if (token) {
      router.replace('/dashboard');
    }
  }, [router]);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      symbol: /[^A-Za-z0-9]/.test(password)
    }),
    [password]
  );

  const passwordScore = useMemo(() => Object.values(passwordChecks).filter(Boolean).length, [passwordChecks]);

  function validateForm(): FieldErrors {
    const errors: FieldErrors = {};

    if (firstName.trim().length < 2) {
      errors.firstName = 'First name must be at least 2 characters';
    }
    if (lastName.trim().length < 2) {
      errors.lastName = 'Last name must be at least 2 characters';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (passwordScore < 4) {
      errors.password = 'Use a stronger password (at least 4 of 5 requirements)';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    if (!acceptTerms) {
      errors.confirmPassword = errors.confirmPassword ?? 'Please accept terms to continue';
    }

    return errors;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const errors = validateForm();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password
        })
      });

      const payload = (await response.json()) as {
        tokens?: { accessToken: string; refreshToken: string };
        user?: { email: string };
        message?: string;
      };

      if (!response.ok || !payload.tokens) {
        setError(payload.message ?? 'Registration failed');
        return;
      }

      localStorage.setItem('quiz_access_token', payload.tokens.accessToken);
      localStorage.setItem('quiz_refresh_token', payload.tokens.refreshToken);
      if (redeemCode.trim()) {
        localStorage.setItem('quiz_signup_redeem_code', redeemCode.trim().toUpperCase());
      } else {
        localStorage.removeItem('quiz_signup_redeem_code');
      }
      setSuccess(`Account created for ${payload.user?.email ?? email}`);
      router.push('/dashboard');
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="glass-card auth-card">
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.85rem' }}>QuizOS</p>
        <h1 style={{ marginTop: '.2rem', marginBottom: '.8rem', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
          Create Account
        </h1>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Start free. Add your workspace, team, and quizzes in minutes.
        </p>
        <form onSubmit={onSubmit}>
          <div style={{ display: 'grid', gap: '.7rem', gridTemplateColumns: '1fr 1fr' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
              {fieldErrors.firstName ? <small className="error-text">{fieldErrors.firstName}</small> : null}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
              {fieldErrors.lastName ? <small className="error-text">{fieldErrors.lastName}</small> : null}
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
            {fieldErrors.email ? <small className="error-text">{fieldErrors.email}</small> : null}
          </div>
          <div className="field">
            <label htmlFor="redeemCode">Redeem code (optional)</label>
            <input
              id="redeemCode"
              type="text"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
              placeholder="WELCOME40"
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <div className="password-meter">
              <span style={{ width: `${(passwordScore / 5) * 100}%` }} />
            </div>
            <div className="checklist">
              <span className={passwordChecks.minLength ? 'ok' : ''}>8+ chars</span>
              <span className={passwordChecks.upper ? 'ok' : ''}>Uppercase</span>
              <span className={passwordChecks.lower ? 'ok' : ''}>Lowercase</span>
              <span className={passwordChecks.number ? 'ok' : ''}>Number</span>
              <span className={passwordChecks.symbol ? 'ok' : ''}>Symbol</span>
            </div>
            {fieldErrors.password ? <small className="error-text">{fieldErrors.password}</small> : null}
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword ? <small className="error-text">{fieldErrors.confirmPassword}</small> : null}
          </div>
          <label className="terms-row">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
            />
            <span>
              I agree to the Terms and Privacy Policy.
            </span>
          </label>
          <div style={{ color: 'var(--muted)', fontSize: '.84rem', marginBottom: '.6rem' }}>
            All features are free right now. Billing gates will be added later.
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {error ? <p style={{ color: '#b91c1c', marginBottom: 0 }}>{error}</p> : null}
        {success ? <p style={{ color: '#065f46', marginBottom: 0 }}>{success}</p> : null}

        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--brand-strong)', fontWeight: 700 }}>
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
