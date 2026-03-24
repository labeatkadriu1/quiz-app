'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT';
type QuizFlowMode = 'STEP_BY_STEP' | 'ALL_AT_ONCE';
type QuizContentType = 'QUIZ' | 'FORM' | 'POLL_SURVEY' | 'MINIGAME' | 'PERSONALITY_QUIZ' | 'PREDICTOR' | 'LEADERBOARD' | 'STORY';

interface OptionItem {
  id: string;
  label: string;
  value: string;
  isCorrect?: boolean;
}

interface QuestionItem {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation?: string | null;
  points: number;
  position: number;
  metadata?: { imageUrl?: string } | null;
  answerOptions: OptionItem[];
}

interface QuizItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  passScore: number;
  contentType?: QuizContentType;
  questionFlowMode?: QuizFlowMode;
  questions: QuestionItem[];
}

interface EndFormField {
  type: string;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface EndFormSettings {
  enabled: boolean;
  requireSubmit: boolean;
  title: string;
  description: string;
  submitLabel: string;
  fields: EndFormField[];
}

interface PredictorConfig {
  badgeText: string;
  titleText: string;
  leftTeamName: string;
  rightTeamName: string;
  leftTeamLogoUrl: string;
  rightTeamLogoUrl: string;
  minScore: number;
  maxScore: number;
  step: number;
  leftScore: number;
  rightScore: number;
}

export default function QuizPreviewPage(): JSX.Element {
  const params = useParams<{ orgId: string; quizId: string }>();
  const router = useRouter();
  const orgId = params.orgId;
  const quizId = params.quizId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizItem | null>(null);
  const [endForm, setEndForm] = useState<EndFormSettings | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({});
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({});
  const [predictorConfig, setPredictorConfig] = useState<PredictorConfig>({
    badgeText: 'GUESS THE SCORE',
    titleText: 'Predictor',
    leftTeamName: 'Team 1',
    rightTeamName: 'Team 2',
    leftTeamLogoUrl: '',
    rightTeamLogoUrl: '',
    minScore: 0,
    maxScore: 10,
    step: 1,
    leftScore: 0,
    rightScore: 0
  });

  useEffect(() => {
    void loadQuiz();
  }, [orgId, quizId]);

  const mode = quiz?.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP';
  const currentQuestion = useMemo(() => quiz?.questions[currentIndex] ?? null, [quiz, currentIndex]);

  async function loadQuiz(): Promise<void> {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/quizzes`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as QuizItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        setError('Unable to load quiz preview');
        return;
      }
      const found = payload.find((item) => item.id === quizId) ?? null;
      if (!found) {
        setError('Quiz not found');
        return;
      }
      setQuiz({
        ...found,
        questions: [...(found.questions ?? [])].sort((a, b) => a.position - b.position)
      });

      const endFormResponse = await fetch(`${API_BASE}/quizzes/${quizId}/end-form`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const endFormPayload = (await endFormResponse.json()) as EndFormSettings | { message?: string };
      if (endFormResponse.ok && 'fields' in endFormPayload) {
        setEndForm(endFormPayload as EndFormSettings);
      } else {
        setEndForm(null);
      }

      const predictorResponse = await fetch(`${API_BASE}/quizzes/${quizId}/predictor-config`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const predictorPayload = (await predictorResponse.json()) as { predictorConfig?: PredictorConfig };
      if (predictorResponse.ok && predictorPayload.predictorConfig) {
        setPredictorConfig(predictorPayload.predictorConfig);
      }
    } catch {
      setError('Unable to load quiz preview');
    } finally {
      setLoading(false);
    }
  }

  function toggleChoice(questionId: string, optionId: string, multiple: boolean): void {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = multiple
        ? current.includes(optionId)
          ? current.filter((item) => item !== optionId)
          : [...current, optionId]
        : [optionId];
      return {
        ...prev,
        [questionId]: next
      };
    });
  }

  function toStringValue(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return value[0] ?? '';
    }
    return value ?? '';
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading quiz preview...</p>
        </section>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p style={{ color: '#b91c1c' }}>{error ?? 'Quiz not found'}</p>
          <Link href={`/dashboard/workspace/${orgId}/quizzes/${quizId}/builder`} className="btn btn-ghost">
            Back to Builder
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Preview Mode (before publish)</p>
          <h1 style={{ margin: '.2rem 0' }}>{quiz.title}</h1>
          <p style={{ marginTop: 0, color: 'var(--muted)' }}>{quiz.description ?? 'No description'}</p>
          <div className="chip-row">
            <span className="chip">Status: {quiz.status}</span>
            <span className="chip">Content: {(quiz.contentType ?? 'QUIZ').replace(/_/g, ' ')}</span>
            <span className="chip">Questions: {quiz.questions.length}</span>
            <span className="chip">Flow: {mode === 'ALL_AT_ONCE' ? 'All at once' : 'Step by step'}</span>
          </div>
          <div style={{ marginTop: '.7rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <Link href={`/dashboard/workspace/${orgId}/quizzes/${quizId}/builder`} className="btn btn-ghost">
              Back to Builder
            </Link>
          </div>
        </div>
      </section>

      <section className="container">
        {quiz.contentType === 'FORM' ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{endForm?.title || 'Form Preview'}</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>{endForm?.description || 'Preview of your form fields.'}</p>
            {endForm?.fields && endForm.fields.length > 0 ? (
              <div style={{ display: 'grid', gap: '.65rem', marginTop: '.65rem' }}>
                {endForm.fields.map((field) => (
                  <div key={field.key} className="field" style={{ marginBottom: 0 }}>
                    <label>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {field.type === 'long_text' ? (
                      <textarea
                        rows={4}
                        value={toStringValue(formValues[field.key])}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        placeholder={field.placeholder || ''}
                        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '0.72rem 0.8rem', fontSize: '.95rem' }}
                      />
                    ) : field.type === 'dropdown' || field.type === 'country' ? (
                      <select
                        value={toStringValue(formValues[field.key])}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '0.72rem 0.8rem', fontSize: '.95rem' }}
                      >
                        <option value="">Select...</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div style={{ display: 'grid', gap: '.4rem' }}>
                        {(field.options ?? []).map((option) => (
                          <label key={option} className="glass-card" style={{ padding: '.55rem', display: 'flex', gap: '.5rem' }}>
                            <input
                              type="radio"
                              name={`preview-${field.key}`}
                              checked={toStringValue(formValues[field.key]) === option}
                              onChange={() => setFormValues((prev) => ({ ...prev, [field.key]: option }))}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div style={{ display: 'grid', gap: '.4rem' }}>
                        {(field.options ?? []).map((option) => {
                          const values = Array.isArray(formValues[field.key]) ? (formValues[field.key] as string[]) : [];
                          const checked = values.includes(option);
                          return (
                            <label key={option} className="glass-card" style={{ padding: '.55rem', display: 'flex', gap: '.5rem' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setFormValues((prev) => {
                                    const current = Array.isArray(prev[field.key]) ? (prev[field.key] as string[]) : [];
                                    const next = checked ? current.filter((item) => item !== option) : [...current, option];
                                    return { ...prev, [field.key]: next };
                                  })
                                }
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
                        value={toStringValue(formValues[field.key])}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                        placeholder={field.placeholder || ''}
                        style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: '0.72rem 0.8rem', fontSize: '.95rem' }}
                      />
                    )}
                  </div>
                ))}
                <div style={{ marginTop: '.35rem' }}>
                  <button className="btn btn-primary" type="button">
                    {endForm?.submitLabel || 'Submit'}
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No form fields found yet. Add fields in builder and save.</p>
            )}
          </article>
        ) : quiz.contentType === 'PREDICTOR' ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <div style={{ background: '#111827', borderRadius: 20, padding: '1rem', border: '1px solid #2a3a52', color: '#e2e8f0' }}>
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: 999,
                  background: '#030712',
                  color: '#f8fafc',
                  padding: '.2rem .55rem',
                  fontSize: '.72rem',
                  fontWeight: 700,
                  letterSpacing: '.08em'
                }}
              >
                {predictorConfig.badgeText}
              </span>
              <h3 style={{ margin: '.55rem 0 .8rem', color: '#f8fafc' }}>{predictorConfig.titleText}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '.6rem', alignItems: 'stretch' }}>
                <div style={{ borderRadius: 14, padding: '.8rem', background: '#0b1220', border: '1px solid #27354a' }}>
                  {predictorConfig.leftTeamLogoUrl ? (
                    <img
                      src={predictorConfig.leftTeamLogoUrl}
                      alt={predictorConfig.leftTeamName}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 999, display: 'block', margin: '0 auto .45rem' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        border: '2px solid #334155',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto .45rem',
                        color: '#94a3b8',
                        fontSize: '.66rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.05
                      }}
                    >
                      ADD
                      <br />
                      LOGO
                    </div>
                  )}
                  <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700 }}>{predictorConfig.leftTeamName}</p>
                  <div style={{ marginTop: '.55rem', display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: '.35rem', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>-</div>
                    <div style={{ border: '1px solid #475569', borderRadius: 10, textAlign: 'center', padding: '.22rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
                      {predictorConfig.leftScore}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>+</div>
                  </div>
                </div>
                <div style={{ alignSelf: 'center', width: 38, height: 38, borderRadius: 999, border: '1px solid #475569', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#94a3b8' }}>
                  VS
                </div>
                <div style={{ borderRadius: 14, padding: '.8rem', background: '#0b1220', border: '1px solid #27354a' }}>
                  {predictorConfig.rightTeamLogoUrl ? (
                    <img
                      src={predictorConfig.rightTeamLogoUrl}
                      alt={predictorConfig.rightTeamName}
                      style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 999, display: 'block', margin: '0 auto .45rem' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 999,
                        border: '2px solid #334155',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto .45rem',
                        color: '#94a3b8',
                        fontSize: '.66rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        lineHeight: 1.05
                      }}
                    >
                      ADD
                      <br />
                      LOGO
                    </div>
                  )}
                  <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700 }}>{predictorConfig.rightTeamName}</p>
                  <div style={{ marginTop: '.55rem', display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: '.35rem', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>-</div>
                    <div style={{ border: '1px solid #475569', borderRadius: 10, textAlign: 'center', padding: '.22rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
                      {predictorConfig.rightScore}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>+</div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ) : mode === 'ALL_AT_ONCE' ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gap: '.8rem' }}>
              {quiz.questions.map((question) => (
                <div key={question.id} className="glass-card" style={{ padding: '.75rem' }}>
                  <h3 style={{ marginTop: 0 }}>
                    Q{question.position}. {question.prompt}
                  </h3>
                  {question.metadata?.imageUrl ? (
                    <div style={{ marginBottom: '.55rem' }}>
                      <img
                        src={question.metadata.imageUrl}
                        alt={`Question ${question.position}`}
                        style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 12, border: '1px solid var(--line)' }}
                      />
                    </div>
                  ) : null}
                  {question.type === 'SHORT_TEXT' ? (
                    <textarea
                      rows={4}
                      value={shortAnswers[question.id] ?? ''}
                      onChange={(event) =>
                        setShortAnswers((prev) => ({
                          ...prev,
                          [question.id]: event.target.value
                        }))
                      }
                      style={{
                        width: '100%',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        padding: '0.72rem 0.8rem',
                        fontSize: '.95rem',
                        background: '#fff'
                      }}
                    />
                  ) : (
                    <div style={{ display: 'grid', gap: '.5rem' }}>
                      {question.answerOptions.map((option) => {
                        const selected = (answers[question.id] ?? []).includes(option.id);
                        return (
                          <label key={option.id} className="glass-card" style={{ padding: '.65rem', display: 'flex', gap: '.55rem' }}>
                            <input
                              type={question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                              checked={selected}
                              name={`preview-${question.id}`}
                              onChange={() =>
                                toggleChoice(question.id, option.id, question.type === 'MULTIPLE_CHOICE')
                              }
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        ) : currentQuestion ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>
              Q{currentQuestion.position}. {currentQuestion.prompt}
            </h3>
            {currentQuestion.metadata?.imageUrl ? (
              <div style={{ marginBottom: '.55rem' }}>
                <img
                  src={currentQuestion.metadata.imageUrl}
                  alt={`Question ${currentQuestion.position}`}
                  style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 12, border: '1px solid var(--line)' }}
                />
              </div>
            ) : null}

            {currentQuestion.type === 'SHORT_TEXT' ? (
              <textarea
                rows={5}
                value={shortAnswers[currentQuestion.id] ?? ''}
                onChange={(event) =>
                  setShortAnswers((prev) => ({
                    ...prev,
                    [currentQuestion.id]: event.target.value
                  }))
                }
                style={{
                  width: '100%',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '0.72rem 0.8rem',
                  fontSize: '.95rem',
                  background: '#fff'
                }}
              />
            ) : (
              <div style={{ display: 'grid', gap: '.5rem' }}>
                {currentQuestion.answerOptions.map((option) => {
                  const selected = (answers[currentQuestion.id] ?? []).includes(option.id);
                  return (
                    <label key={option.id} className="glass-card" style={{ padding: '.65rem', display: 'flex', gap: '.55rem' }}>
                      <input
                        type={currentQuestion.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                        checked={selected}
                        name={`preview-${currentQuestion.id}`}
                        onChange={() =>
                          toggleChoice(
                            currentQuestion.id,
                            option.id,
                            currentQuestion.type === 'MULTIPLE_CHOICE'
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: '.85rem', display: 'flex', gap: '.5rem' }}>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                disabled={currentIndex === 0}
              >
                Previous
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, quiz.questions.length - 1))}
                disabled={currentIndex >= quiz.questions.length - 1}
              >
                Next
              </button>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
