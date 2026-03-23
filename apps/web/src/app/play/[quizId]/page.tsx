'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const AUTO_ADVANCE_DELAY_MS = 2000;

type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT';
type QuizFlowMode = 'STEP_BY_STEP' | 'ALL_AT_ONCE';

interface PublicOption {
  id: string;
  label: string;
  value: string;
  position: number;
}

interface PublicQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation?: string | null;
  imageUrl?: string | null;
  points: number;
  position: number;
  correctOptionIds?: string[];
  answerOptions: PublicOption[];
}

interface EndFormField {
  type: string;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

interface PublicEndForm {
  enabled: boolean;
  requireSubmit: boolean;
  title: string;
  description: string;
  submitLabel: string;
  fields: EndFormField[];
}

interface PublicQuiz {
  id: string;
  title: string;
  description?: string | null;
  passScore: number;
  questionFlowMode: QuizFlowMode;
  showAnswerFeedback: boolean;
  publicAccessMode: 'PUBLIC_LINK' | 'PASSWORD' | 'APPROVAL';
  requiresPassword: boolean;
  requiresApprovedEmail: boolean;
  endForm: PublicEndForm;
  questions: PublicQuestion[];
}

interface ResultItem {
  earnedPoints: number;
  totalPoints: number;
  percentage: number;
  passed: boolean;
  answerReview?: Array<{
    questionId: string;
    position: number;
    prompt: string;
    type: QuestionType;
    selectedOptionIds: string[];
    selectedOptionLabels: string[];
    shortTextAnswer: string | null;
    correctOptionIds: string[];
    correctOptionLabels: string[];
    isCorrect: boolean | null;
  }>;
}

export default function PublicQuizPlayerPage(): JSX.Element {
  const params = useParams<{ quizId: string }>();
  const searchParams = useSearchParams();
  const quizId = params.quizId;
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<PublicQuiz | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({});
  const [lockedQuestions, setLockedQuestions] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<ResultItem | null>(null);
  const [endFormValues, setEndFormValues] = useState<Record<string, string>>({});
  const [endFormSubmitted, setEndFormSubmitted] = useState(false);

  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  useEffect(() => {
    void loadQuiz();
  }, [quizId, token]);

  useEffect(() => {
    if (quiz?.title) {
      document.title = `${quiz.title} | QuizOS`;
      return;
    }
    document.title = 'Play Quiz | QuizOS';
  }, [quiz?.title]);

  const isAllAtOnceMode = quiz?.questionFlowMode === 'ALL_AT_ONCE';
  const currentQuestion = useMemo(
    () => (isAllAtOnceMode ? null : quiz?.questions[currentIndex] ?? null),
    [quiz, currentIndex, isAllAtOnceMode]
  );

  async function loadQuiz(): Promise<void> {
    setLoading(true);
    setError(null);

    if (!token) {
      setError('Missing access token in URL.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/public/quizzes/${quizId}?token=${encodeURIComponent(token)}`);
      const payload = (await response.json()) as PublicQuiz | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to load public quiz');
        return;
      }

      const quizPayload = payload as PublicQuiz;
      const sortedQuestions = [...quizPayload.questions].sort((a, b) => a.position - b.position);
      setQuiz({
        ...quizPayload,
        questions: sortedQuestions
      });
    } catch {
      setError('Unable to load public quiz');
    } finally {
      setLoading(false);
    }
  }

  function getNextSelectedOptions(questionId: string, optionId: string, multiple: boolean): string[] {
    const current = answers[questionId] ?? [];
    if (!multiple) {
      return [optionId];
    }
    return current.includes(optionId) ? current.filter((item) => item !== optionId) : [...current, optionId];
  }

  function setSelectedOptions(questionId: string, selectedOptionIds: string[]): void {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOptionIds
    }));
  }

  function isQuestionLocked(questionId: string): boolean {
    return Boolean(lockedQuestions[questionId]);
  }

  function isQuestionAnswered(question: PublicQuestion): boolean {
    if (question.type === 'SHORT_TEXT') {
      return (shortAnswers[question.id] ?? '').trim().length > 0;
    }
    return (answers[question.id] ?? []).length > 0;
  }

  function isSelectionCorrect(question: PublicQuestion): boolean | null {
    const correctIds = [...(question.correctOptionIds ?? [])].sort();
    if (correctIds.length === 0) {
      return null;
    }
    const selected = [...(answers[question.id] ?? [])].sort();
    if (selected.length === 0) {
      return null;
    }
    return correctIds.length === selected.length && correctIds.every((value, idx) => value === selected[idx]);
  }

  function optionFeedbackStyle(question: PublicQuestion, optionId: string, selected: boolean) {
    if (!quiz?.showAnswerFeedback || !isQuestionAnswered(question) || question.type === 'SHORT_TEXT') {
      return {};
    }
    const isCorrectOption = (question.correctOptionIds ?? []).includes(optionId);
    const selectionCorrect = isSelectionCorrect(question);

    if (isCorrectOption) {
      return {
        border: '1px solid #16a34a',
        background: 'rgba(22, 163, 74, .13)'
      };
    }
    if (selected && selectionCorrect === false) {
      return {
        border: '1px solid #dc2626',
        background: 'rgba(220, 38, 38, .12)'
      };
    }
    return {};
  }

  async function startAttempt(): Promise<void> {
    if (!quiz) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/public/quizzes/${quiz.id}/attempts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token,
          password: password || undefined,
          email: email || undefined
        })
      });

      const payload = (await response.json()) as { id?: string; message?: string };
      if (!response.ok || !payload.id) {
        setError(payload.message ?? 'Unable to start attempt');
        return;
      }

      setAttemptId(payload.id);
      setCurrentIndex(0);
    } catch {
      setError('Unable to start attempt');
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswerForQuestion(question: PublicQuestion, selectedOverride?: string[]): Promise<boolean> {
    if (!attemptId) {
      return false;
    }

    const selectedOptionIds = selectedOverride ?? answers[question.id] ?? [];
    const shortText = shortAnswers[question.id] ?? '';

    const payload =
      question.type === 'SHORT_TEXT'
        ? { text: shortText }
        : { selectedOptionIds };

    try {
      const response = await fetch(`${API_BASE}/public/attempts/${attemptId}/answers`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: {
            questionId: question.id,
            answerPayload: payload
          }
        })
      });
      if (!response.ok) {
        const responsePayload = (await response.json()) as { message?: string };
        setError(responsePayload.message ?? 'Unable to save answer');
        return false;
      }
      return true;
    } catch {
      setError('Unable to save answer');
      return false;
    }
  }

  async function nextQuestion(): Promise<void> {
    setError(null);
    if (!currentQuestion) {
      return;
    }
    const ok = await saveAnswerForQuestion(currentQuestion);
    if (!ok) {
      return;
    }
    setLockedQuestions((prev) => ({
      ...prev,
      [currentQuestion.id]: true
    }));
    setCurrentIndex((prev) => Math.min(prev + 1, (quiz?.questions.length ?? 1) - 1));
  }

  async function onStepOptionSelect(question: PublicQuestion, optionId: string): Promise<void> {
    if (isQuestionLocked(question.id)) {
      return;
    }

    const multiple = question.type === 'MULTIPLE_CHOICE';
    const nextSelected = getNextSelectedOptions(question.id, optionId, multiple);
    setSelectedOptions(question.id, nextSelected);

    if (question.type !== 'MULTIPLE_CHOICE') {
      setLockedQuestions((prev) => ({
        ...prev,
        [question.id]: true
      }));
    }

    if (quiz?.questionFlowMode !== 'STEP_BY_STEP') {
      return;
    }
    if (multiple || question.type === 'SHORT_TEXT' || autoAdvancing) {
      return;
    }

    setAutoAdvancing(true);
    setError(null);
    const ok = await saveAnswerForQuestion(question, nextSelected);
    if (ok) {
      await new Promise((resolve) => setTimeout(resolve, AUTO_ADVANCE_DELAY_MS));
      setCurrentIndex((prev) => Math.min(prev + 1, (quiz?.questions.length ?? 1) - 1));
    }
    setAutoAdvancing(false);
  }

  async function previousQuestion(): Promise<void> {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  async function submitAttempt(): Promise<void> {
    if (!attemptId) {
      return;
    }

    setBusy(true);
    setError(null);

    let ok = true;
    if (isAllAtOnceMode) {
      const allQuestions = quiz?.questions ?? [];
      for (const question of allQuestions) {
        // Save every answer snapshot before final submit.
        // eslint-disable-next-line no-await-in-loop
        const saved = await saveAnswerForQuestion(question);
        if (!saved) {
          ok = false;
          break;
        }
      }
    } else if (currentQuestion) {
      ok = await saveAnswerForQuestion(currentQuestion);
    }
    if (!ok) {
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/public/attempts/${attemptId}/submit`, {
        method: 'POST'
      });
      const payload = (await response.json()) as ResultItem | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to submit attempt');
        return;
      }

      setResult(payload as ResultItem);
    } catch {
      setError('Unable to submit attempt');
    } finally {
      setBusy(false);
    }
  }

  async function submitEndForm(): Promise<void> {
    if (!attemptId || !quiz?.endForm?.enabled) {
      return;
    }

    const missing = quiz.endForm.fields.find(
      (field) => field.required && !(endFormValues[field.key] ?? '').trim()
    );
    if (missing) {
      setError(`${missing.label} is required`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/public/attempts/${attemptId}/end-form`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: endFormValues
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to submit form');
        return;
      }
      setEndFormSubmitted(true);
    } catch {
      setError('Unable to submit form');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading public quiz...</p>
        </section>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p style={{ color: '#b91c1c' }}>{error ?? 'Quiz not found'}</p>
          <Link href="/" className="btn btn-ghost">
            Back to Landing
          </Link>
        </section>
      </main>
    );
  }

  if (result) {
    const showEndForm = quiz.endForm?.enabled && !endFormSubmitted;
    const requireFormToFinish = Boolean(quiz.endForm?.enabled && quiz.endForm.requireSubmit);

    return (
      <main className="auth-shell">
        <section className="glass-card auth-card" style={{ width: 'min(580px, 100%)' }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Quiz Completed</p>
          <h1 style={{ margin: '.35rem 0 0.5rem' }}>{quiz.title}</h1>
          <div className="chip-row" style={{ marginBottom: '.8rem' }}>
            <span className="chip">Score: {result.earnedPoints}/{result.totalPoints}</span>
            <span className="chip">Percentage: {result.percentage}%</span>
            <span className="chip">Status: {result.passed ? 'Passed' : 'Not Passed'}</span>
          </div>

          {quiz.showAnswerFeedback && result.answerReview && result.answerReview.length > 0 ? (
            <div className="glass-card" style={{ padding: '.8rem', marginBottom: '.8rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '.55rem' }}>Answer Review</h3>
              <div style={{ display: 'grid', gap: '.5rem' }}>
                {result.answerReview.map((item) => (
                  <div
                    key={item.questionId}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '.55rem .62rem',
                      background:
                        item.isCorrect === true
                          ? 'rgba(22, 163, 74, .10)'
                          : item.isCorrect === false
                            ? 'rgba(220, 38, 38, .09)'
                            : 'rgba(148, 163, 184, .11)'
                    }}
                  >
                    <strong>
                      Q{item.position}. {item.prompt}
                    </strong>
                    {item.type === 'SHORT_TEXT' ? (
                      <p style={{ margin: '.3rem 0 0', fontSize: '.9rem' }}>
                        Your answer: {item.shortTextAnswer || '-'}
                      </p>
                    ) : (
                      <>
                        <p style={{ margin: '.3rem 0 0', fontSize: '.9rem' }}>
                          Your answer: {item.selectedOptionLabels.length > 0 ? item.selectedOptionLabels.join(', ') : '-'}
                        </p>
                        <p style={{ margin: '.2rem 0 0', fontSize: '.85rem', color: 'var(--muted)' }}>
                          Correct: {item.correctOptionLabels.join(', ') || '-'}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {showEndForm ? (
            <div className="glass-card" style={{ padding: '.8rem', marginBottom: '.7rem' }}>
              <h3 style={{ marginTop: 0 }}>{quiz.endForm.title}</h3>
              <p style={{ color: 'var(--muted)', marginTop: 0 }}>{quiz.endForm.description}</p>
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {quiz.endForm.fields.map((field) => (
                  <div className="field" key={field.key} style={{ marginBottom: 0 }}>
                    <label htmlFor={`end-form-${field.key}`}>
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={`end-form-${field.key}`}
                        rows={4}
                        value={endFormValues[field.key] ?? ''}
                        onChange={(event) =>
                          setEndFormValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value
                          }))
                        }
                        placeholder={field.placeholder ?? ''}
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
                      <input
                        id={`end-form-${field.key}`}
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={endFormValues[field.key] ?? ''}
                        onChange={(event) =>
                          setEndFormValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value
                          }))
                        }
                        placeholder={field.placeholder ?? ''}
                      />
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" onClick={() => void submitEndForm()} disabled={busy}>
                {busy
                  ? 'Submitting...'
                  : requireFormToFinish
                    ? 'Submit form to finish'
                    : quiz.endForm.submitLabel || 'Submit'}
              </button>
            </div>
          ) : null}

          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          {!showEndForm && (!requireFormToFinish || endFormSubmitted) ? (
            <Link className="btn btn-primary" href="/">
              Finish
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  if (!attemptId) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card" style={{ width: 'min(620px, 100%)' }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Public Quiz Access</p>
          <h1 style={{ margin: '.3rem 0' }}>{quiz.title}</h1>
          <p style={{ color: 'var(--muted)' }}>{quiz.description ?? 'Start when you are ready.'}</p>

          {quiz.requiresPassword ? (
            <div className="field">
              <label htmlFor="publicPassword">Password</label>
              <input
                id="publicPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : null}

          {quiz.requiresApprovedEmail ? (
            <div className="field">
              <label htmlFor="publicEmail">Approved Email</label>
              <input
                id="publicEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
          ) : null}

          {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
          <button className="btn btn-primary" onClick={() => void startAttempt()} disabled={busy}>
            {busy ? 'Starting...' : 'Start Quiz'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Public Quiz Player</p>
          <h1 style={{ margin: '.2rem 0' }}>{quiz.title}</h1>
          <div className="chip-row">
            {quiz.questionFlowMode === 'STEP_BY_STEP' ? (
              <span className="chip">
                Question {currentIndex + 1} / {quiz.questions.length}
              </span>
            ) : (
              <span className="chip">All Questions View</span>
            )}
            <span className="chip">Pass Score: {quiz.passScore}%</span>
          </div>
        </div>
      </section>

      <section className="container">
        {quiz.questionFlowMode === 'ALL_AT_ONCE' ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gap: '.8rem' }}>
              {quiz.questions.map((question) => (
                <div key={question.id} className="glass-card" style={{ padding: '.75rem' }}>
                  <h3 style={{ marginTop: 0 }}>
                    Q{question.position}. {question.prompt}
                  </h3>
                  {question.imageUrl ? (
                    <div style={{ marginBottom: '.6rem' }}>
                      <img
                        src={question.imageUrl}
                        alt={`Question ${question.position}`}
                        style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 12, border: '1px solid var(--line)' }}
                      />
                    </div>
                  ) : null}
                  {question.type === 'SHORT_TEXT' ? (
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor={`short-${question.id}`}>Your answer</label>
                      <textarea
                        id={`short-${question.id}`}
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
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '.5rem' }}>
                      {question.answerOptions.map((option) => {
                        const selected = (answers[question.id] ?? []).includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className="glass-card"
                            style={{
                              padding: '.65rem',
                              display: 'flex',
                              gap: '.55rem',
                              ...optionFeedbackStyle(question, option.id, selected)
                            }}
                          >
                            <input
                              type={question.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                              checked={selected}
                              name={`question-${question.id}`}
                              disabled={isQuestionLocked(question.id)}
                              onChange={() => void onStepOptionSelect(question, option.id)}
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {quiz.showAnswerFeedback && question.type !== 'SHORT_TEXT' && isQuestionAnswered(question) ? (
                    <p
                      style={{
                        margin: '.45rem 0 0',
                        color: isSelectionCorrect(question) ? '#166534' : '#b91c1c',
                        fontWeight: 600,
                        fontSize: '.86rem'
                      }}
                    >
                      {isSelectionCorrect(question) ? 'Correct answer' : 'Incorrect answer'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => void submitAttempt()} disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </div>
          </article>
        ) : currentQuestion ? (
          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>
              Q{currentQuestion.position}. {currentQuestion.prompt}
            </h3>
            {currentQuestion.imageUrl ? (
              <div style={{ marginBottom: '.65rem' }}>
                <img
                  src={currentQuestion.imageUrl}
                  alt={`Question ${currentQuestion.position}`}
                  style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 12, border: '1px solid var(--line)' }}
                />
              </div>
            ) : null}

            {currentQuestion.type === 'SHORT_TEXT' ? (
              <div className="field">
                <label htmlFor="shortAnswer">Your answer</label>
                <textarea
                  id="shortAnswer"
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
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '.5rem' }}>
                {currentQuestion.answerOptions.map((option) => {
                  const selected = (answers[currentQuestion.id] ?? []).includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className="glass-card"
                      style={{
                        padding: '.65rem',
                        display: 'flex',
                        gap: '.55rem',
                        ...optionFeedbackStyle(currentQuestion, option.id, selected)
                      }}
                    >
                      <input
                        type={currentQuestion.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'}
                        checked={selected}
                        name={`question-${currentQuestion.id}`}
                        disabled={isQuestionLocked(currentQuestion.id)}
                        onChange={() => void onStepOptionSelect(currentQuestion, option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {quiz.showAnswerFeedback && currentQuestion.type !== 'SHORT_TEXT' && isQuestionAnswered(currentQuestion) ? (
              <p
                style={{
                  margin: '.55rem 0 0',
                  color: isSelectionCorrect(currentQuestion) ? '#166534' : '#b91c1c',
                  fontWeight: 600,
                  fontSize: '.86rem'
                }}
              >
                {isSelectionCorrect(currentQuestion) ? 'Correct answer' : 'Incorrect answer'}
              </p>
            ) : null}

            {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}

            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => void previousQuestion()} disabled={currentIndex === 0 || busy || autoAdvancing}>
                Previous
              </button>
              {currentIndex < quiz.questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => void nextQuestion()} disabled={busy || autoAdvancing}>
                  Next
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => void submitAttempt()} disabled={busy || autoAdvancing}>
                  {busy ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
