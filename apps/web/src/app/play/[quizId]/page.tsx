'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  options?: string[];
}

interface PublicEndForm {
  enabled: boolean;
  requireSubmit: boolean;
  title: string;
  description: string;
  submitLabel: string;
  fields: EndFormField[];
}

interface PublicQuizTheme {
  backgroundColor: string;
  backgroundGradient: string;
  cardColor: string;
  textColor: string;
  mutedTextColor: string;
  primaryColor: string;
  primaryTextColor: string;
  correctColor: string;
  wrongColor: string;
  fontFamily: string;
}

interface PublicStartScreenConfig {
  enabled: boolean;
  mode: 'DEFAULT' | 'CUSTOM';
  showGlassCard: boolean;
  title: string;
  description: string;
  buttonLabel: string;
  introHtml?: string;
  coverImageUrl?: string;
}

interface PublicQuiz {
  id: string;
  title: string;
  description?: string | null;
  contentType?: string;
  passScore: number;
  theme: PublicQuizTheme;
  startScreenConfig: PublicStartScreenConfig;
  questionFlowMode: QuizFlowMode;
  showAnswerFeedback: boolean;
  predictorConfig?: {
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
  };
  publicAccessMode: 'PUBLIC_LINK' | 'PASSWORD' | 'APPROVAL';
  requiresPassword: boolean;
  requiresApprovedEmail: boolean;
  endForm: PublicEndForm;
  questions: PublicQuestion[];
}

const DEFAULT_THEME: PublicQuizTheme = {
  backgroundColor: '#f3f6ff',
  backgroundGradient: 'linear-gradient(135deg, #f3f6ff 0%, #eef8ff 50%, #f9f4ff 100%)',
  cardColor: '#ffffff',
  textColor: '#0f172a',
  mutedTextColor: '#475569',
  primaryColor: '#0f766e',
  primaryTextColor: '#ffffff',
  correctColor: '#16a34a',
  wrongColor: '#dc2626',
  fontFamily: '"Avenir Next", "Segoe UI", sans-serif'
};

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
  const [endFormValues, setEndFormValues] = useState<Record<string, string | string[]>>({});
  const [endFormSubmitted, setEndFormSubmitted] = useState(false);
  const [predictorLeftScore, setPredictorLeftScore] = useState(0);
  const [predictorRightScore, setPredictorRightScore] = useState(0);

  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);
  const autoStartTriggeredRef = useRef(false);

  useEffect(() => {
    void loadQuiz();
  }, [quizId, token]);

  useEffect(() => {
    autoStartTriggeredRef.current = false;
  }, [quizId, token]);

  useEffect(() => {
    if (quiz?.title) {
      document.title = `${quiz.title} | QuizOS`;
      return;
    }
    document.title = 'Play Quiz | QuizOS';
  }, [quiz?.title]);

  useEffect(() => {
    if (!quiz || attemptId || busy || error || autoStartTriggeredRef.current) {
      return;
    }
    const needsManualGate = quiz.requiresPassword || quiz.requiresApprovedEmail;
    const startScreenEnabled = quiz.startScreenConfig?.enabled ?? false;
    if (needsManualGate || startScreenEnabled) {
      return;
    }
    autoStartTriggeredRef.current = true;
    setAutoStarting(true);
    void startAttempt().finally(() => {
      setAutoStarting(false);
    });
  }, [quiz, attemptId, busy, error]);

  const isAllAtOnceMode = quiz?.questionFlowMode === 'ALL_AT_ONCE';
  const theme = quiz?.theme ?? DEFAULT_THEME;
  const useGlassCard = quiz?.startScreenConfig?.showGlassCard ?? false;
  const withGlassCard = (baseClass = '') => `${useGlassCard ? 'glass-card ' : ''}${baseClass}`.trim();
  const pageStyle = {
    minHeight: '100vh',
    background: theme.backgroundGradient || theme.backgroundColor,
    color: theme.textColor,
    fontFamily: theme.fontFamily
  };
  const cardStyle = {
    background: theme.cardColor,
    color: theme.textColor
  };
  const containerCardStyle = useGlassCard
    ? cardStyle
    : ({
        background: theme.cardColor,
        color: theme.textColor,
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)'
      } as const);
  const primaryButtonStyle = {
    background: theme.primaryColor,
    color: theme.primaryTextColor,
    border: 'none'
  };
  const currentQuestion = useMemo(
    () => (isAllAtOnceMode ? null : quiz?.questions[currentIndex] ?? null),
    [quiz, currentIndex, isAllAtOnceMode]
  );

  function withOpacity(color: string, alphaHex: string): string {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      return `${color}${alphaHex}`;
    }
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      return `#${r}${r}${g}${g}${b}${b}${alphaHex}`;
    }
    return color;
  }

  function updatePredictorScore(side: 'left' | 'right', direction: 'inc' | 'dec'): void {
    if (!quiz?.predictorConfig) {
      return;
    }
    const min = quiz.predictorConfig.minScore ?? 0;
    const max = quiz.predictorConfig.maxScore ?? 10;
    const step = Math.max(1, quiz.predictorConfig.step ?? 1);
    const next = (value: number) => {
      const updated = direction === 'inc' ? value + step : value - step;
      return Math.max(min, Math.min(max, updated));
    };
    if (side === 'left') {
      setPredictorLeftScore((prev) => next(prev));
      return;
    }
    setPredictorRightScore((prev) => next(prev));
  }

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
      autoStartTriggeredRef.current = false;
      setPredictorLeftScore(quizPayload.predictorConfig?.leftScore ?? 0);
      setPredictorRightScore(quizPayload.predictorConfig?.rightScore ?? 0);
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
        border: `1px solid ${theme.correctColor}`,
        background: withOpacity(theme.correctColor, '22')
      };
    }
    if (selected && selectionCorrect === false) {
      return {
        border: `1px solid ${theme.wrongColor}`,
        background: withOpacity(theme.wrongColor, '22')
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(
          quiz?.contentType === 'PREDICTOR'
            ? {
                predictor: {
                  leftScore: predictorLeftScore,
                  rightScore: predictorRightScore,
                  leftTeamName: quiz.predictorConfig?.leftTeamName ?? 'Team 1',
                  rightTeamName: quiz.predictorConfig?.rightTeamName ?? 'Team 2'
                }
              }
            : {}
        )
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

    const validationError = validateEndFormValues(quiz.endForm.fields, endFormValues);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!result) {
        const submitResponse = await fetch(`${API_BASE}/public/attempts/${attemptId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        const submitPayload = (await submitResponse.json()) as ResultItem | { message?: string };
        if (!submitResponse.ok) {
          setError(('message' in submitPayload ? submitPayload.message : null) ?? 'Unable to submit form');
          return;
        }
        setResult(submitPayload as ResultItem);
      }

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

  function toStringValue(value: string | string[] | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  function toArrayValue(value: string | string[] | undefined): string[] {
    return Array.isArray(value) ? value : [];
  }

  function isOptionField(typeValue: string): boolean {
    return ['dropdown', 'radio', 'checkbox', 'country'].includes(typeValue);
  }

  function validateEndFormValues(
    fields: EndFormField[],
    values: Record<string, string | string[]>
  ): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

    for (const field of fields) {
      const fieldType = field.type.toLowerCase();
      const stringValue = toStringValue(values[field.key]).trim();
      const arrayValue = toArrayValue(values[field.key]);

      if (field.required) {
        const missing = fieldType === 'checkbox' ? arrayValue.length === 0 : stringValue.length === 0;
        if (missing) {
          return `${field.label} is required`;
        }
      }

      if (!field.required && !stringValue && arrayValue.length === 0) {
        continue;
      }

      if (fieldType === 'email' && stringValue && !emailRegex.test(stringValue)) {
        return `${field.label} must be a valid email`;
      }
      if (fieldType === 'phone' && stringValue && !phoneRegex.test(stringValue)) {
        return `${field.label} must be a valid phone number`;
      }
      if (fieldType === 'url' && stringValue) {
        try {
          // eslint-disable-next-line no-new
          new URL(stringValue);
        } catch {
          return `${field.label} must be a valid URL`;
        }
      }
      if (fieldType === 'number' && stringValue && Number.isNaN(Number(stringValue))) {
        return `${field.label} must be a valid number`;
      }
      if (fieldType === 'rating' && stringValue) {
        const rating = Number(stringValue);
        if (Number.isNaN(rating) || rating < 1 || rating > 5) {
          return `${field.label} must be between 1 and 5`;
        }
      }
    }

    return null;
  }

  function sanitizeIntroHtml(input: string): string {
    let html = input;
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\son\w+="[^"]*"/gi, '');
    html = html.replace(/\son\w+='[^']*'/gi, '');
    html = html.replace(/javascript:/gi, '');
    return html.trim();
  }

  if (loading) {
    return (
      <main className="auth-shell" style={pageStyle}>
        <section className={withGlassCard('auth-card')} style={containerCardStyle}>
          <p>Loading public quiz...</p>
        </section>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="auth-shell" style={pageStyle}>
        <section className={withGlassCard('auth-card')} style={containerCardStyle}>
          <p style={{ color: theme.wrongColor }}>{error ?? 'Quiz not found'}</p>
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
      <main className="auth-shell" style={pageStyle}>
        <section className={withGlassCard('auth-card')} style={{ width: 'min(580px, 100%)', ...containerCardStyle }}>
          <p style={{ margin: 0, color: theme.mutedTextColor }}>{quiz.contentType === 'FORM' ? 'Form Completed' : 'Quiz Completed'}</p>
          <h1 style={{ margin: '.35rem 0 0.5rem' }}>{quiz.title}</h1>
          {quiz.contentType !== 'FORM' ? (
            <div className="chip-row" style={{ marginBottom: '.8rem' }}>
              <span className="chip">Score: {result.earnedPoints}/{result.totalPoints}</span>
              <span className="chip">Percentage: {result.percentage}%</span>
              <span className="chip">Status: {result.passed ? 'Passed' : 'Not Passed'}</span>
            </div>
          ) : null}

          {quiz.contentType !== 'FORM' && quiz.showAnswerFeedback && result.answerReview && result.answerReview.length > 0 ? (
            <div className={withGlassCard()} style={{ padding: '.8rem', marginBottom: '.8rem' }}>
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
                        <p style={{ margin: '.2rem 0 0', fontSize: '.85rem', color: theme.mutedTextColor }}>
                          Correct: {item.correctOptionLabels.join(', ') || '-'}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {quiz.contentType === 'FORM' && endFormSubmitted ? (
            <div className={withGlassCard()} style={{ padding: '.8rem', marginBottom: '.75rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '.45rem' }}>Submitted Values</h3>
              <div style={{ display: 'grid', gap: '.3rem', fontSize: '.9rem' }}>
                {Object.entries(endFormValues).map(([key, value]) => (
                  <div key={`submitted-${key}`}>
                    <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : value}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {showEndForm ? (
            <div className={withGlassCard()} style={{ padding: '.8rem', marginBottom: '.7rem' }}>
              <h3 style={{ marginTop: 0 }}>{quiz.endForm.title}</h3>
              <p style={{ color: theme.mutedTextColor, marginTop: 0 }}>{quiz.endForm.description}</p>
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {quiz.endForm.fields.map((field) => (
                  <div className="field" key={field.key} style={{ marginBottom: 0 }}>
                    <label htmlFor={`end-form-${field.key}`}>
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    {field.type === 'long_text' || field.type === 'textarea' ? (
                      <textarea
                        id={`end-form-${field.key}`}
                        rows={4}
                        value={toStringValue(endFormValues[field.key])}
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
                    ) : field.type === 'radio' ? (
                      <div style={{ display: 'grid', gap: '.35rem' }}>
                        {(field.options ?? []).map((option) => (
                          <label key={`${field.key}-${option}`} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                            <input
                              type="radio"
                              name={`end-form-radio-${field.key}`}
                              checked={toStringValue(endFormValues[field.key]) === option}
                              onChange={() =>
                                setEndFormValues((prev) => ({
                                  ...prev,
                                  [field.key]: option
                                }))
                              }
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : isOptionField(field.type) && field.type !== 'checkbox' ? (
                      <select
                        id={`end-form-${field.key}`}
                        value={toStringValue(endFormValues[field.key])}
                        onChange={(event) =>
                          setEndFormValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value
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
                      >
                        <option value="">Select...</option>
                        {(field.type === 'country' && (!field.options || field.options.length === 0)
                          ? ['Kosovo', 'Albania', 'North Macedonia', 'Montenegro', 'Serbia', 'Germany', 'Switzerland', 'United States']
                          : field.options ?? []
                        ).map((option) => (
                          <option key={`${field.key}-${option}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox' ? (
                      <div style={{ display: 'grid', gap: '.35rem' }}>
                        {(field.options ?? []).map((option) => {
                          const selectedValues = toArrayValue(endFormValues[field.key]);
                          const checked = selectedValues.includes(option);
                          return (
                            <label key={`${field.key}-${option}`} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setEndFormValues((prev) => {
                                    const current = toArrayValue(prev[field.key]);
                                    const next = event.target.checked
                                      ? [...current, option]
                                      : current.filter((item) => item !== option);
                                    return {
                                      ...prev,
                                      [field.key]: next
                                    };
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
                        id={`end-form-${field.key}`}
                        type={
                          field.type === 'email'
                            ? 'email'
                            : field.type === 'phone'
                              ? 'tel'
                              : field.type === 'url' || field.type === 'media'
                                ? 'url'
                                : field.type === 'date'
                                  ? 'date'
                                  : field.type === 'time'
                                    ? 'time'
                                    : field.type === 'number' || field.type === 'rating'
                                      ? 'number'
                                      : 'text'
                        }
                        min={field.type === 'rating' ? 1 : undefined}
                        max={field.type === 'rating' ? 5 : undefined}
                        value={toStringValue(endFormValues[field.key])}
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
              <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitEndForm()} disabled={busy}>
                {busy
                  ? 'Submitting...'
                  : requireFormToFinish
                    ? 'Submit form to finish'
                    : quiz.endForm.submitLabel || 'Submit'}
              </button>
            </div>
          ) : null}

          {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}
          {!showEndForm && (!requireFormToFinish || endFormSubmitted) ? (
            <Link className="btn btn-primary" style={primaryButtonStyle} href="/">
              Finish
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  if (!attemptId) {
    const startConfig = quiz.startScreenConfig ?? {
      enabled: false,
      mode: 'DEFAULT' as const,
      showGlassCard: false,
      title: quiz.title,
      description: quiz.description ?? 'Start when you are ready.',
      buttonLabel: 'Start Quiz'
    };
    const title = startConfig.mode === 'CUSTOM' ? startConfig.title || quiz.title : quiz.title;
    const description =
      startConfig.mode === 'CUSTOM'
        ? startConfig.description || quiz.description || 'Start when you are ready.'
        : quiz.description || 'Start when you are ready.';
    const buttonLabel = startConfig.mode === 'CUSTOM' ? startConfig.buttonLabel || 'Start Quiz' : 'Start Quiz';
    const introHtml = sanitizeIntroHtml(startConfig.mode === 'CUSTOM' ? startConfig.introHtml || '' : '');
    const hasCoverHero = startConfig.mode === 'CUSTOM' && Boolean(startConfig.coverImageUrl);
    const canStartInline = !quiz.requiresPassword && !quiz.requiresApprovedEmail;
    if (autoStarting) {
      return (
        <main className="auth-shell" style={pageStyle}>
          <section className="auth-card" style={{ width: 'min(620px, 100%)', ...cardStyle }}>
            <p style={{ margin: 0, color: theme.mutedTextColor }}>Preparing your quiz...</p>
          </section>
        </main>
      );
    }

    return (
      <main className="auth-shell" style={pageStyle}>
        <section className={withGlassCard('auth-card')} style={{ width: 'min(620px, 100%)', ...containerCardStyle }}>
          {hasCoverHero ? (
            <div
              style={{
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                minHeight: 320,
                marginBottom: '.8rem',
                border: '1px solid rgba(148,163,184,.25)'
              }}
            >
              <img
                src={startConfig.coverImageUrl}
                alt={`${quiz.title} cover`}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(2,6,23,.25) 0%, rgba(2,6,23,.78) 72%, rgba(2,6,23,.92) 100%)',
                  color: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  textAlign: 'center',
                  padding: '1rem'
                }}
              >
                <p style={{ margin: 0, color: 'rgba(226,232,240,.9)' }}>Public Quiz Access</p>
                <h1 style={{ margin: '.3rem 0', color: '#ffffff' }}>{title}</h1>
                <p style={{ color: 'rgba(226,232,240,.9)', marginTop: 0 }}>{description}</p>
                {introHtml ? (
                  <div
                    style={{ marginBottom: '.75rem', lineHeight: 1.6, color: 'rgba(241,245,249,.96)' }}
                    dangerouslySetInnerHTML={{ __html: introHtml }}
                  />
                ) : null}
                {canStartInline ? (
                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void startAttempt()} disabled={busy}>
                      {busy ? 'Starting...' : buttonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {!hasCoverHero ? <p style={{ margin: 0, color: theme.mutedTextColor }}>Public Quiz Access</p> : null}
          {!hasCoverHero ? <h1 style={{ margin: '.3rem 0' }}>{title}</h1> : null}
          {!hasCoverHero ? <p style={{ color: theme.mutedTextColor }}>{description}</p> : null}
          {!hasCoverHero && startConfig.mode === 'CUSTOM' && introHtml ? (
            <div style={{ marginBottom: '.7rem', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: introHtml }} />
          ) : null}

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

          {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}
          {!canStartInline || !hasCoverHero ? (
            <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void startAttempt()} disabled={busy}>
              {busy ? 'Starting...' : buttonLabel}
            </button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main style={{ ...pageStyle, padding: '1rem 0 2rem' }}>
      {useGlassCard ? (
        <section className="container">
          <div className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: theme.mutedTextColor, fontSize: '.82rem' }}>Public Quiz Player</p>
            <h1 style={{ margin: '.2rem 0' }}>{quiz.title}</h1>
            <div className="chip-row">
              {quiz.contentType === 'FORM' ? (
                <span className="chip">Form Mode</span>
              ) : quiz.contentType === 'PREDICTOR' ? (
                <span className="chip">Predictor Mode</span>
              ) : quiz.questionFlowMode === 'STEP_BY_STEP' ? (
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
      ) : null}

      <section className="container">
        {quiz.contentType === 'FORM' ? (
          <article className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{quiz.endForm.title || 'Form'}</h3>
            <p style={{ color: theme.mutedTextColor, marginTop: 0 }}>{quiz.endForm.description || 'Complete the form and submit.'}</p>
            <div style={{ display: 'grid', gap: '.6rem' }}>
              {quiz.endForm.fields.map((field) => (
                <div className="field" key={field.key} style={{ marginBottom: 0 }}>
                  <label htmlFor={`form-mode-${field.key}`}>
                    {field.label} {field.required ? '*' : ''}
                  </label>
                  {field.type === 'long_text' || field.type === 'textarea' ? (
                    <textarea
                      id={`form-mode-${field.key}`}
                      rows={4}
                      value={toStringValue(endFormValues[field.key])}
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
                  ) : field.type === 'radio' ? (
                    <div style={{ display: 'grid', gap: '.35rem' }}>
                      {(field.options ?? []).map((option) => (
                        <label key={`${field.key}-${option}`} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`form-mode-radio-${field.key}`}
                            checked={toStringValue(endFormValues[field.key]) === option}
                            onChange={() =>
                              setEndFormValues((prev) => ({
                                ...prev,
                                [field.key]: option
                              }))
                            }
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : isOptionField(field.type) && field.type !== 'checkbox' ? (
                    <select
                      id={`form-mode-${field.key}`}
                      value={toStringValue(endFormValues[field.key])}
                      onChange={(event) =>
                        setEndFormValues((prev) => ({
                          ...prev,
                          [field.key]: event.target.value
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
                    >
                      <option value="">Select...</option>
                      {(field.type === 'country' && (!field.options || field.options.length === 0)
                        ? ['Kosovo', 'Albania', 'North Macedonia', 'Montenegro', 'Serbia', 'Germany', 'Switzerland', 'United States']
                        : field.options ?? []
                      ).map((option) => (
                        <option key={`${field.key}-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <div style={{ display: 'grid', gap: '.35rem' }}>
                      {(field.options ?? []).map((option) => {
                        const selectedValues = toArrayValue(endFormValues[field.key]);
                        const checked = selectedValues.includes(option);
                        return (
                          <label key={`${field.key}-${option}`} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setEndFormValues((prev) => {
                                  const current = toArrayValue(prev[field.key]);
                                  const next = event.target.checked ? [...current, option] : current.filter((item) => item !== option);
                                  return {
                                    ...prev,
                                    [field.key]: next
                                  };
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
                      id={`form-mode-${field.key}`}
                      type={
                        field.type === 'email'
                          ? 'email'
                          : field.type === 'phone'
                            ? 'tel'
                            : field.type === 'url' || field.type === 'media'
                              ? 'url'
                              : field.type === 'date'
                                ? 'date'
                                : field.type === 'time'
                                  ? 'time'
                                  : field.type === 'number' || field.type === 'rating'
                                    ? 'number'
                                    : 'text'
                      }
                      min={field.type === 'rating' ? 1 : undefined}
                      max={field.type === 'rating' ? 5 : undefined}
                      value={toStringValue(endFormValues[field.key])}
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
            {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitEndForm()} disabled={busy}>
                {busy ? 'Submitting...' : quiz.endForm.submitLabel || 'Submit'}
              </button>
            </div>
          </article>
        ) : quiz.contentType === 'PREDICTOR' ? (
          <article className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem' }}>
            <div style={{ background: '#111827', borderRadius: 20, padding: '1rem', border: '1px solid #2a3a52', color: '#e2e8f0' }}>
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: 999,
                  background: '#030712',
                  color: '#f8fafc',
                  padding: '.2rem .58rem',
                  fontSize: '.72rem',
                  fontWeight: 700,
                  letterSpacing: '.08em'
                }}
              >
                {quiz.predictorConfig?.badgeText || 'GUESS THE SCORE'}
              </span>
              <h3 style={{ margin: '.55rem 0 .8rem', color: '#f8fafc' }}>{quiz.predictorConfig?.titleText || 'Predictor'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '.7rem', alignItems: 'stretch' }}>
                <div style={{ borderRadius: 14, background: '#0b1220', border: '1px solid #27354a', padding: '.75rem' }}>
                  {quiz.predictorConfig?.leftTeamLogoUrl ? (
                    <img
                      src={quiz.predictorConfig.leftTeamLogoUrl}
                      alt={quiz.predictorConfig.leftTeamName || 'Team 1'}
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
                  <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700 }}>
                    {quiz.predictorConfig?.leftTeamName || 'Team 1'}
                  </p>
                  <div style={{ marginTop: '.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.55rem' }}>
                    <button className="btn btn-ghost" onClick={() => updatePredictorScore('left', 'dec')} style={{ borderRadius: 999, width: 34, height: 34, padding: 0, background: '#fff', color: '#111827', fontWeight: 800 }}>
                      -
                    </button>
                    <strong style={{ fontSize: '2rem', minWidth: 72, textAlign: 'center', color: '#f8fafc', border: '1px solid #475569', borderRadius: 10, lineHeight: 1.25, padding: '.08rem 0' }}>
                      {predictorLeftScore}
                    </strong>
                    <button className="btn btn-ghost" onClick={() => updatePredictorScore('left', 'inc')} style={{ borderRadius: 999, width: 34, height: 34, padding: 0, background: '#fff', color: '#111827', fontWeight: 800 }}>
                      +
                    </button>
                  </div>
                </div>
                <div style={{ alignSelf: 'center', width: 38, height: 38, borderRadius: 999, border: '1px solid #475569', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#94a3b8' }}>
                  VS
                </div>
                <div style={{ borderRadius: 14, background: '#0b1220', border: '1px solid #27354a', padding: '.75rem' }}>
                  {quiz.predictorConfig?.rightTeamLogoUrl ? (
                    <img
                      src={quiz.predictorConfig.rightTeamLogoUrl}
                      alt={quiz.predictorConfig.rightTeamName || 'Team 2'}
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
                  <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700 }}>
                    {quiz.predictorConfig?.rightTeamName || 'Team 2'}
                  </p>
                  <div style={{ marginTop: '.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.55rem' }}>
                    <button className="btn btn-ghost" onClick={() => updatePredictorScore('right', 'dec')} style={{ borderRadius: 999, width: 34, height: 34, padding: 0, background: '#fff', color: '#111827', fontWeight: 800 }}>
                      -
                    </button>
                    <strong style={{ fontSize: '2rem', minWidth: 72, textAlign: 'center', color: '#f8fafc', border: '1px solid #475569', borderRadius: 10, lineHeight: 1.25, padding: '.08rem 0' }}>
                      {predictorRightScore}
                    </strong>
                    <button className="btn btn-ghost" onClick={() => updatePredictorScore('right', 'inc')} style={{ borderRadius: 999, width: 34, height: 34, padding: 0, background: '#fff', color: '#111827', fontWeight: 800 }}>
                      +
                    </button>
                  </div>
                </div>
              </div>
              <p style={{ margin: '.65rem 0 0', color: '#94a3b8', fontSize: '.82rem' }}>
                Range: {quiz.predictorConfig?.minScore ?? 0} - {quiz.predictorConfig?.maxScore ?? 10}
              </p>
            </div>
            {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitAttempt()} disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Prediction'}
              </button>
            </div>
          </article>
        ) : quiz.questionFlowMode === 'ALL_AT_ONCE' ? (
          <article className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem' }}>
            <div style={{ display: 'grid', gap: '.8rem' }}>
              {quiz.questions.map((question) => (
                <div key={question.id} className={withGlassCard()} style={{ padding: '.75rem' }}>
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
                            className={withGlassCard()}
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
                        color: isSelectionCorrect(question) ? theme.correctColor : theme.wrongColor,
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

            {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitAttempt()} disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Quiz'}
              </button>
            </div>
          </article>
        ) : currentQuestion ? (
          <article className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem' }}>
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
                      className={withGlassCard()}
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
                  color: isSelectionCorrect(currentQuestion) ? theme.correctColor : theme.wrongColor,
                  fontWeight: 600,
                  fontSize: '.86rem'
                }}
              >
                {isSelectionCorrect(currentQuestion) ? 'Correct answer' : 'Incorrect answer'}
              </p>
            ) : null}

            {error ? <p style={{ color: theme.wrongColor }}>{error}</p> : null}

            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={() => void previousQuestion()} disabled={currentIndex === 0 || busy || autoAdvancing}>
                Previous
              </button>
              {currentIndex < quiz.questions.length - 1 ? (
                <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void nextQuestion()} disabled={busy || autoAdvancing}>
                  Next
                </button>
              ) : (
                <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitAttempt()} disabled={busy || autoAdvancing}>
                  {busy ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </article>
        ) : (
          <article className={withGlassCard()} style={{ ...containerCardStyle, padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>
              {quiz.contentType === 'FORM' ? 'Form Experience' : 'No Questions'}
            </h3>
            <p style={{ color: theme.mutedTextColor }}>
              {quiz.contentType === 'FORM'
                ? 'This content type uses form capture. Click submit to continue to form.'
                : 'No questions configured yet for this quiz.'}
            </p>
            <button className="btn btn-primary" style={primaryButtonStyle} onClick={() => void submitAttempt()} disabled={busy || autoAdvancing}>
              {busy ? 'Submitting...' : 'Continue'}
            </button>
          </article>
        )}
      </section>
    </main>
  );
}
