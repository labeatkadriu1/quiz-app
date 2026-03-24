'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT';
type QuizFlowMode = 'STEP_BY_STEP' | 'ALL_AT_ONCE';
type BuilderTab = 'QUESTIONS' | 'DESIGN' | 'ASSIGNMENT' | 'ACCESS' | 'END_FORM' | 'INSIGHTS';
type QuizContentType = 'QUIZ' | 'FORM' | 'POLL_SURVEY' | 'MINIGAME' | 'PERSONALITY_QUIZ' | 'PREDICTOR' | 'LEADERBOARD' | 'STORY';
type PublicAccessMode = 'PUBLIC_LINK' | 'APPROVAL' | 'PASSWORD';
type AssignmentScope =
  | 'STUDENT'
  | 'SELECTED_STUDENTS'
  | 'CLASS'
  | 'MULTI_CLASS'
  | 'TEACHER_STUDENTS'
  | 'SCHOOL_WIDE'
  | 'PUBLIC_LINK'
  | 'EMBED_PUBLIC'
  | 'REQUEST_LINK';

interface OptionItem {
  id?: string;
  label: string;
  value: string;
  isCorrect?: boolean;
}

interface QuestionItem {
  id: string;
  type: QuestionType;
  prompt: string;
  explanation?: string | null;
  metadata?: {
    imageUrl?: string;
  } | null;
  points: number;
  position: number;
  answerOptions?: OptionItem[];
}

interface QuizItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  contentType?: QuizContentType;
  passScore: number;
  questionFlowMode?: QuizFlowMode;
  showAnswerFeedback?: boolean;
  questions?: QuestionItem[];
}

interface QuizSettings {
  quizId: string;
  questionFlowMode: QuizFlowMode;
  showAnswerFeedback: boolean;
}

interface QuizTheme {
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

interface StartScreenConfig {
  enabled: boolean;
  mode: 'DEFAULT' | 'CUSTOM';
  showGlassCard: boolean;
  title: string;
  description: string;
  buttonLabel: string;
  introHtml: string;
  coverImageUrl: string;
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

interface PublicAccessSettings {
  quizId: string;
  enabled: boolean;
  mode: PublicAccessMode;
  token: string | null;
  publicUrl: string | null;
  approvedEmails: string[];
}

interface ClassItem {
  id: string;
  name: string;
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

interface AssignmentTargetItem {
  targetType: string;
  userId?: string | null;
  classId?: string | null;
  schoolId?: string | null;
}

interface AssignmentItem {
  id: string;
  scopeType: AssignmentScope | string;
  startAt?: string | null;
  endAt?: string | null;
  attemptLimit?: number | null;
  passScoreOverride?: number | null;
  requestAccessToken?: string | null;
  requestUrl?: string | null;
  targets: AssignmentTargetItem[];
}

interface AssignmentAccessRequestItem {
  id: string;
  name: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  reviewedAt?: string | null;
  reviewedNote?: string | null;
}

interface AttemptAnswerItem {
  questionId: string;
  position: number;
  prompt: string;
  type: QuestionType;
  points: number;
  correctOptionLabels: string[];
  selectedOptionIds: string[];
  selectedOptionLabels: string[];
  shortTextAnswer: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
  rawAnswerPayload: Record<string, unknown> | null;
}

interface AttemptItem {
  attemptId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  percentage: number | null;
  participant: {
    userId: string | null;
    email: string;
    name: string | null;
  };
  result: {
    earnedPoints: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
  } | null;
  predictorSubmission?: {
    leftScore?: number;
    rightScore?: number;
    leftTeamName?: string | null;
    rightTeamName?: string | null;
  } | null;
  formSubmission?: Record<string, unknown> | null;
  answers: AttemptAnswerItem[];
}

interface QuizAttemptsResponse {
  quiz: {
    id: string;
    title: string;
    passScore: number;
    questionCount: number;
  };
  summary: {
    totalAttempts: number;
    submittedAttempts: number;
    inProgressAttempts: number;
    averageScore: number;
  };
  questionStats: Array<{
    questionId: string;
    position: number;
    prompt: string;
    answeredCount: number;
    correctCount: number;
    incorrectCount: number;
    correctRate: number;
  }>;
  attempts: AttemptItem[];
}

interface EndFormField {
  type: string;
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  optionsInput?: string;
}

interface EndFormSettings {
  quizId: string;
  enabled: boolean;
  requireSubmit: boolean;
  title: string;
  description: string;
  submitLabel: string;
  fields: EndFormField[];
}

const FORM_FIELD_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Button' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date Picker' },
  { value: 'time', label: 'Time Picker' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'country', label: 'Country Picker' },
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'media', label: 'Media (URL)' }
];

export default function QuizBuilderPage(): JSX.Element {
  const params = useParams<{ orgId: string; quizId: string }>();
  const router = useRouter();
  const orgId = params.orgId;
  const quizId = params.quizId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizItem | null>(null);

  const [type, setType] = useState<QuestionType>('SINGLE_CHOICE');
  const [prompt, setPrompt] = useState('');
  const [explanation, setExplanation] = useState('');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState<OptionItem[]>([
    { label: 'Option A', value: 'A', isCorrect: false },
    { label: 'Option B', value: 'B', isCorrect: false }
  ]);
  const [trueFalseCorrect, setTrueFalseCorrect] = useState<'TRUE' | 'FALSE'>('TRUE');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [publicAccess, setPublicAccess] = useState<PublicAccessSettings | null>(null);
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(false);
  const [publicAccessMode, setPublicAccessMode] = useState<PublicAccessMode>('PUBLIC_LINK');
  const [publicPassword, setPublicPassword] = useState('');
  const [approvedEmailsText, setApprovedEmailsText] = useState('');

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [assignmentScope, setAssignmentScope] = useState<AssignmentScope>('CLASS');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignmentStartAt, setAssignmentStartAt] = useState('');
  const [assignmentEndAt, setAssignmentEndAt] = useState('');
  const [assignmentAttemptLimit, setAssignmentAttemptLimit] = useState<number | ''>('');
  const [latestAssignment, setLatestAssignment] = useState<AssignmentItem | null>(null);
  const [assignmentRequests, setAssignmentRequests] = useState<AssignmentAccessRequestItem[]>([]);
  const [activeBuilderTab, setActiveBuilderTab] = useState<BuilderTab>('QUESTIONS');
  const [quizContentType, setQuizContentType] = useState<QuizContentType>('QUIZ');
  const [quizFlowMode, setQuizFlowMode] = useState<QuizFlowMode>('STEP_BY_STEP');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(true);
  const [quizTheme, setQuizTheme] = useState<QuizTheme>({
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
  });
  const [startScreenConfig, setStartScreenConfig] = useState<StartScreenConfig>({
    enabled: false,
    mode: 'DEFAULT',
    showGlassCard: false,
    title: '',
    description: '',
    buttonLabel: 'Start Quiz',
    introHtml: '',
    coverImageUrl: ''
  });
  const startIntroEditorRef = useRef<HTMLDivElement | null>(null);
  const [attemptInsights, setAttemptInsights] = useState<QuizAttemptsResponse | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [endFormSettings, setEndFormSettings] = useState<EndFormSettings | null>(null);
  const [endFormEnabled, setEndFormEnabled] = useState(false);
  const [endFormRequireSubmit, setEndFormRequireSubmit] = useState(false);
  const [endFormTitle, setEndFormTitle] = useState('Stay Connected');
  const [endFormDescription, setEndFormDescription] = useState('Leave your details at the end of the quiz.');
  const [endFormSubmitLabel, setEndFormSubmitLabel] = useState('Submit');
  const [endFormFields, setEndFormFields] = useState<EndFormField[]>([
    { type: 'text', key: 'name', label: 'Name', placeholder: 'Your name', required: false },
    { type: 'email', key: 'email', label: 'Email', placeholder: 'you@example.com', required: false }
  ]);
  const [leadSubmissions, setLeadSubmissions] = useState<
    Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null; createdAt: string }>
  >([]);
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
    void loadAll();
  }, [orgId, quizId]);

  useEffect(() => {
    if (startScreenConfig.mode !== 'CUSTOM') {
      return;
    }
    if (!startIntroEditorRef.current) {
      return;
    }
    if (startIntroEditorRef.current.innerHTML !== (startScreenConfig.introHtml || '')) {
      startIntroEditorRef.current.innerHTML = startScreenConfig.introHtml || '';
    }
  }, [startScreenConfig.mode, startScreenConfig.introHtml]);

  const nextPosition = useMemo(() => (quiz?.questions?.length ?? 0) + 1, [quiz]);
  const isChoiceType = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  const previewQuestion = useMemo(() => {
    const fromBuilder =
      prompt.trim().length > 0
        ? {
            prompt: prompt.trim(),
            explanation: explanation.trim(),
            type,
            options:
              type === 'TRUE_FALSE'
                ? [
                    { label: 'True', isCorrect: trueFalseCorrect === 'TRUE' },
                    { label: 'False', isCorrect: trueFalseCorrect === 'FALSE' }
                  ]
                : options.filter((item) => item.label.trim().length > 0).map((item) => ({
                    label: item.label.trim(),
                    isCorrect: Boolean(item.isCorrect)
                  }))
          }
        : null;

    if (fromBuilder) {
      return fromBuilder;
    }

    const first = quiz?.questions?.[0];
    if (!first) {
      return null;
    }

    return {
      prompt: first.prompt,
      explanation: first.explanation ?? '',
      type: first.type,
      options: (first.answerOptions ?? []).map((item) => ({
        label: item.label,
        isCorrect: Boolean(item.isCorrect)
      }))
    };
  }, [prompt, explanation, type, trueFalseCorrect, options, quiz]);

  const previewWrongOptionIndex = useMemo(() => {
    if (!previewQuestion?.options || previewQuestion.options.length === 0) {
      return -1;
    }
    const wrongIdx = previewQuestion.options.findIndex((item) => !item.isCorrect);
    return wrongIdx >= 0 ? wrongIdx : 0;
  }, [previewQuestion]);

  const previewCorrectOptionIndex = useMemo(() => {
    if (!previewQuestion?.options || previewQuestion.options.length === 0) {
      return -1;
    }
    return previewQuestion.options.findIndex((item) => item.isCorrect);
  }, [previewQuestion]);

  const canPreviewQuiz = useMemo(() => {
    if (quizContentType === 'FORM') {
      return endFormFields.length > 0;
    }
    if (quizContentType === 'PREDICTOR') {
      return predictorConfig.leftTeamName.trim().length > 0 && predictorConfig.rightTeamName.trim().length > 0;
    }
    return (quiz?.questions?.length ?? 0) > 0;
  }, [quizContentType, endFormFields.length, predictorConfig.leftTeamName, predictorConfig.rightTeamName, quiz]);

  const studentCandidates = useMemo(
    () =>
      members.filter((member) => {
        const key = member.role?.key ?? '';
        return key.includes('STUDENT') || key.includes('LEARNER') || key === '';
      }),
    [members]
  );

  async function loadAll(): Promise<void> {
    setLoading(true);
    const loadedQuiz = await loadQuiz();
    await Promise.all([
      loadPublicAccess(),
      loadAssignmentData(),
      loadLatestAssignment(),
      loadEndForm(),
      loadQuizSettings(),
      loadQuizTheme(),
      loadStartScreenConfig(),
      loadPredictorConfig()
    ]);
    if (loadedQuiz?.status === 'PUBLISHED') {
      await Promise.all([loadAttemptInsights(), loadLeadSubmissions()]);
    } else {
      setAttemptInsights(null);
      setLeadSubmissions([]);
    }
    setLoading(false);
  }

  function toDateTimeLocalValue(value?: string | null): string {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const pad = (input: number) => String(input).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function getTokenOrRedirect(): string | null {
    const token = localStorage.getItem('quiz_access_token');
    if (!token) {
      router.replace('/login');
      return null;
    }
    return token;
  }

  async function loadQuiz(): Promise<QuizItem | null> {
    const token = getTokenOrRedirect();
    if (!token) {
      return null;
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
        setError('Unable to load quiz data');
        return null;
      }

      const found = payload.find((item) => item.id === quizId) ?? null;
      if (!found) {
        setError('Quiz not found in this organization');
        return null;
      }

      const sortedQuestions = [...(found.questions ?? [])].sort((a, b) => a.position - b.position);
      setQuiz({
        ...found,
        questions: sortedQuestions
      });
      setQuizContentType((found.contentType as QuizContentType) ?? 'QUIZ');
      setQuizFlowMode(found.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP');
      setShowAnswerFeedback(found.showAnswerFeedback ?? true);
      return found;
    } catch {
      setError('Unable to load quiz data');
      return null;
    }
  }

  async function loadPublicAccess(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/public-access`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as PublicAccessSettings | { message?: string };
      if (!response.ok) {
        return;
      }

      const settings = payload as PublicAccessSettings;
      setPublicAccess(settings);
      setPublicAccessEnabled(settings.enabled);
      setPublicAccessMode(settings.mode);
      setApprovedEmailsText(settings.approvedEmails.join('\n'));
    } catch {
      // Silent fallback: this panel remains editable.
    }
  }

  async function loadQuizSettings(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as QuizSettings | { message?: string };
      if (!response.ok) {
        return;
      }
      const settings = payload as QuizSettings;
      setQuizFlowMode(settings.questionFlowMode === 'ALL_AT_ONCE' ? 'ALL_AT_ONCE' : 'STEP_BY_STEP');
      setShowAnswerFeedback(settings.showAnswerFeedback);
    } catch {
      // Non-blocking.
    }
  }

  async function loadQuizTheme(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/theme`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { quizId: string; theme: QuizTheme } | { message?: string };
      if (!response.ok || !('theme' in payload)) {
        return;
      }
      setQuizTheme(payload.theme);
    } catch {
      // Non-blocking.
    }
  }

  async function loadStartScreenConfig(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/start-screen`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { quizId: string; startScreenConfig: StartScreenConfig } | { message?: string };
      if (!response.ok || !('startScreenConfig' in payload)) {
        return;
      }
      setStartScreenConfig(payload.startScreenConfig);
    } catch {
      // Non-blocking.
    }
  }

  async function loadPredictorConfig(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/predictor-config`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { quizId: string; predictorConfig: PredictorConfig } | { message?: string };
      if (!response.ok || !('predictorConfig' in payload)) {
        return;
      }
      setPredictorConfig(payload.predictorConfig);
    } catch {
      // Non-blocking.
    }
  }

  async function loadAssignmentData(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    try {
      const [classesResponse, membersResponse] = await Promise.all([
        fetch(`${API_BASE}/classes`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        }),
        fetch(`${API_BASE}/organizations/current/members`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': orgId
          }
        })
      ]);

      const classesPayload = (await classesResponse.json()) as ClassItem[] | { message?: string };
      const membersPayload = (await membersResponse.json()) as MemberItem[] | { message?: string };

      if (classesResponse.ok && Array.isArray(classesPayload)) {
        setClasses(classesPayload);
      }
      if (membersResponse.ok && Array.isArray(membersPayload)) {
        setMembers(membersPayload);
      }
    } catch {
      // Keep assignment panel usable with partial data.
    }
  }

  async function loadAttemptInsights(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/attempts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as QuizAttemptsResponse | { message?: string };
      if (!response.ok) {
        return;
      }
      setAttemptInsights(payload as QuizAttemptsResponse);
    } catch {
      // Keep builder usable if insights are unavailable.
    }
  }

  async function loadLatestAssignment(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/assignments`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as AssignmentItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload) || payload.length === 0) {
        return;
      }

      const latest = payload[0];
      const supportedScopes: AssignmentScope[] = [
        'STUDENT',
        'SELECTED_STUDENTS',
        'CLASS',
        'MULTI_CLASS',
        'TEACHER_STUDENTS',
        'SCHOOL_WIDE',
        'PUBLIC_LINK',
        'EMBED_PUBLIC',
        'REQUEST_LINK'
      ];
      const scope = supportedScopes.includes(latest.scopeType as AssignmentScope)
        ? (latest.scopeType as AssignmentScope)
        : 'CLASS';

      setAssignmentScope(scope);
      setAssignmentStartAt(toDateTimeLocalValue(latest.startAt));
      setAssignmentEndAt(toDateTimeLocalValue(latest.endAt));
      setAssignmentAttemptLimit(typeof latest.attemptLimit === 'number' ? latest.attemptLimit : '');
      setSelectedClassIds(
        latest.targets
          .map((target) => target.classId)
          .filter((id): id is string => Boolean(id))
      );
      setSelectedStudentIds(
        latest.targets
          .map((target) => target.userId)
          .filter((id): id is string => Boolean(id))
      );
      setLatestAssignment(latest);
      if (latest.scopeType === 'REQUEST_LINK') {
        await loadAssignmentRequests(latest.id);
      } else {
        setAssignmentRequests([]);
      }
    } catch {
      // Leave defaults when latest assignment cannot be loaded.
    }
  }

  async function loadAssignmentRequests(assignmentId: string): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/assignments/${assignmentId}/requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as AssignmentAccessRequestItem[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        return;
      }
      setAssignmentRequests(payload);
    } catch {
      // Non-blocking
    }
  }

  async function reviewAssignmentRequest(
    assignmentId: string,
    requestId: string,
    action: 'approve' | 'reject'
  ): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/assignments/${assignmentId}/requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? `Unable to ${action} request`);
        return;
      }
      setSuccess(`Request ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await loadAssignmentRequests(assignmentId);
    } catch {
      setError(`Unable to ${action} request`);
    } finally {
      setBusy(false);
    }
  }

  async function loadEndForm(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/end-form`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as EndFormSettings | { message?: string };
      if (!response.ok) {
        return;
      }
      const settings = payload as EndFormSettings;
      setEndFormSettings(settings);
      setEndFormEnabled(settings.enabled);
      setEndFormRequireSubmit(settings.requireSubmit);
      setEndFormTitle(settings.title);
      setEndFormDescription(settings.description);
      setEndFormSubmitLabel(settings.submitLabel);
      setEndFormFields(settings.fields);
    } catch {
      // Non-blocking
    }
  }

  async function loadLeadSubmissions(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/end-form/submissions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as
        | Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null; createdAt: string }>
        | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        return;
      }
      setLeadSubmissions(payload);
    } catch {
      // Non-blocking
    }
  }

  function updateOption(index: number, patch: Partial<OptionItem>): void {
    setOptions((prev) => prev.map((option, idx) => (idx === index ? { ...option, ...patch } : option)));
  }

  function markCorrect(index: number): void {
    if (type === 'SINGLE_CHOICE') {
      setOptions((prev) => prev.map((option, idx) => ({ ...option, isCorrect: idx === index })));
      return;
    }
    updateOption(index, { isCorrect: !options[index]?.isCorrect });
  }

  function addOption(): void {
    const label = `Option ${String.fromCharCode(65 + options.length)}`;
    setOptions((prev) => [...prev, { label, value: label, isCorrect: false }]);
  }

  function removeOption(index: number): void {
    setOptions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function resetQuestionForm(): void {
    setEditingQuestionId(null);
    setType('SINGLE_CHOICE');
    setPrompt('');
    setExplanation('');
    setQuestionImageUrl('');
    setPoints(1);
    setOptions([
      { label: 'Option A', value: 'A', isCorrect: false },
      { label: 'Option B', value: 'B', isCorrect: false }
    ]);
    setTrueFalseCorrect('TRUE');
  }

  function handleQuestionImageFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 1_000_000) {
      setError('Image is too large. Use up to 1MB for now.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setQuestionImageUrl(result);
      }
    };
    reader.readAsDataURL(file);
  }

  function startEditQuestion(question: QuestionItem): void {
    setEditingQuestionId(question.id);
    setType(question.type);
    setPrompt(question.prompt);
    setExplanation(question.explanation ?? '');
    setQuestionImageUrl(question.metadata?.imageUrl ?? '');
    setPoints(question.points);

    if (question.type === 'TRUE_FALSE') {
      const trueOption = question.answerOptions?.find((option) => option.value === 'TRUE');
      setTrueFalseCorrect(trueOption?.isCorrect ? 'TRUE' : 'FALSE');
      setOptions([
        { label: 'True', value: 'TRUE', isCorrect: trueOption?.isCorrect ?? false },
        {
          label: 'False',
          value: 'FALSE',
          isCorrect: question.answerOptions?.find((option) => option.value === 'FALSE')?.isCorrect ?? false
        }
      ]);
      return;
    }

    if (question.answerOptions && question.answerOptions.length > 0) {
      setOptions(
        question.answerOptions.map((option) => ({
          id: option.id,
          label: option.label,
          value: option.value,
          isCorrect: Boolean(option.isCorrect)
        }))
      );
      return;
    }

    setOptions([
      { label: 'Option A', value: 'A', isCorrect: false },
      { label: 'Option B', value: 'B', isCorrect: false }
    ]);
  }

  function buildOptionsPayload(): OptionItem[] | undefined {
    if (isChoiceType) {
      const sanitized = options
        .map((option) => ({
          label: option.label.trim(),
          value: option.value.trim() || option.label.trim(),
          isCorrect: Boolean(option.isCorrect)
        }))
        .filter((option) => option.label.length > 0);

      if (sanitized.length < 2) {
        throw new Error('Add at least 2 answer options');
      }

      const correctCount = sanitized.filter((option) => option.isCorrect).length;
      if (correctCount === 0) {
        throw new Error('Mark at least one correct answer');
      }
      if (type === 'SINGLE_CHOICE' && correctCount > 1) {
        throw new Error('Single choice question can have only one correct answer');
      }
      return sanitized;
    }

    if (type === 'TRUE_FALSE') {
      return [
        { label: 'True', value: 'TRUE', isCorrect: trueFalseCorrect === 'TRUE' },
        { label: 'False', value: 'FALSE', isCorrect: trueFalseCorrect === 'FALSE' }
      ];
    }

    return undefined;
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    if (!quiz) {
      setError('Quiz not loaded');
      return;
    }
    if (quiz.status !== 'DRAFT') {
      setError('Only DRAFT quizzes can be edited');
      return;
    }
    if (prompt.trim().length < 4) {
      setError('Question prompt must be at least 4 characters');
      return;
    }

    let payloadOptions: OptionItem[] | undefined;
    try {
      payloadOptions = buildOptionsPayload();
    } catch (buildError) {
      setError(buildError instanceof Error ? buildError.message : 'Invalid answer options');
      return;
    }

    setBusy(true);
    try {
      const isEditing = Boolean(editingQuestionId);
      const url = isEditing
        ? `${API_BASE}/quizzes/questions/${editingQuestionId}`
        : `${API_BASE}/quizzes/${quiz.id}/questions`;
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          prompt: prompt.trim(),
          explanation: explanation.trim() || undefined,
          imageUrl: questionImageUrl.trim() || undefined,
          points,
          ...(isEditing ? {} : { position: nextPosition }),
          options: payloadOptions
        })
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? `Unable to ${isEditing ? 'update' : 'add'} question`);
        return;
      }

      setSuccess(isEditing ? 'Question updated successfully.' : 'Question added successfully.');
      resetQuestionForm();
      await loadQuiz();
    } catch {
      setError('Unable to save question');
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion(questionId: string): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    if (!window.confirm('Delete this question?')) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/questions/${questionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to delete question');
        return;
      }

      if (editingQuestionId === questionId) {
        resetQuestionForm();
      }
      setSuccess('Question deleted.');
      await loadQuiz();
    } catch {
      setError('Unable to delete question');
    } finally {
      setBusy(false);
    }
  }

  async function reorderQuestion(questionId: string, direction: 'up' | 'down'): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz || !quiz.questions) {
      return;
    }

    const ordered = [...quiz.questions].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((item) => item.id === questionId);
    if (index < 0) {
      return;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const swapped = [...ordered];
    const current = swapped[index];
    swapped[index] = swapped[targetIndex];
    swapped[targetIndex] = current;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/questions/reorder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionIds: swapped.map((item) => item.id)
        })
      });

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to reorder questions');
        return;
      }

      await loadQuiz();
    } catch {
      setError('Unable to reorder questions');
    } finally {
      setBusy(false);
    }
  }

  async function publishQuiz(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId
        }
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to publish quiz');
        return;
      }
      setSuccess('Quiz published. You can now assign it and enable public access.');
      await loadQuiz();
      await loadAttemptInsights();
    } catch {
      setError('Unable to publish quiz');
    } finally {
      setBusy(false);
    }
  }

  async function saveQuizSettings(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          questionFlowMode: quizFlowMode,
          showAnswerFeedback
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to save quiz settings');
        return;
      }
      setSuccess('Quiz settings updated.');
      await loadQuiz();
    } catch {
      setError('Unable to save quiz settings');
    } finally {
      setBusy(false);
    }
  }

  function updateTheme<K extends keyof QuizTheme>(key: K, value: QuizTheme[K]): void {
    setQuizTheme((prev) => ({
      ...prev,
      [key]: value
    }));
  }

  async function saveQuizTheme(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/theme`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quizTheme)
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to save theme');
        return;
      }
      setSuccess('Theme updated.');
      await loadQuizTheme();
    } catch {
      setError('Unable to save theme');
    } finally {
      setBusy(false);
    }
  }

  function sanitizeIntroHtml(input: string): string {
    let html = input;
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\son\w+="[^"]*"/gi, '');
    html = html.replace(/\son\w+='[^']*'/gi, '');
    html = html.replace(/javascript:/gi, '');
    return html.trim();
  }

  function applyStartIntroCommand(command: string, value?: string): void {
    const editor = startIntroEditorRef.current;
    if (!editor) {
      return;
    }
    editor.focus();
    if (command === 'createLink') {
      const target = window.prompt('Enter URL (https://...)');
      if (!target) {
        return;
      }
      document.execCommand(command, false, target);
    } else {
      document.execCommand(command, false, value ?? '');
    }
    setStartScreenConfig((prev) => ({
      ...prev,
      introHtml: sanitizeIntroHtml(editor.innerHTML)
    }));
  }

  function onStartIntroInput(): void {
    const editor = startIntroEditorRef.current;
    if (!editor) {
      return;
    }
    setStartScreenConfig((prev) => ({
      ...prev,
      introHtml: sanitizeIntroHtml(editor.innerHTML)
    }));
  }

  async function saveStartScreenConfig(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const introHtml =
        startScreenConfig.mode === 'CUSTOM' ? sanitizeIntroHtml(startIntroEditorRef.current?.innerHTML ?? startScreenConfig.introHtml) : '';
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/start-screen`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...startScreenConfig,
          introHtml
        })
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to save start screen settings');
        return;
      }
      setSuccess('Start page settings updated.');
      await loadStartScreenConfig();
    } catch {
      setError('Unable to save start screen settings');
    } finally {
      setBusy(false);
    }
  }

  function updatePredictorConfig<K extends keyof PredictorConfig>(key: K, value: PredictorConfig[K]): void {
    setPredictorConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function savePredictorConfig(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quizId}/predictor-config`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(predictorConfig)
      });
      const payload = (await response.json()) as { predictorConfig?: PredictorConfig; message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to save predictor settings');
        return;
      }
      if (payload.predictorConfig) {
        setPredictorConfig(payload.predictorConfig);
      }
      setSuccess('Predictor settings saved.');
    } catch {
      setError('Unable to save predictor settings');
    } finally {
      setBusy(false);
    }
  }

  async function savePublicAccess(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const approvedEmails = approvedEmailsText
        .split(/\n|,/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);

      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/public-access`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: publicAccessEnabled,
          mode: publicAccessMode,
          password: publicPassword || undefined,
          approvedEmails
        })
      });

      const payload = (await response.json()) as PublicAccessSettings | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to save public access settings');
        return;
      }

      const settings = payload as PublicAccessSettings;
      setPublicAccess(settings);
      setPublicPassword('');
      setApprovedEmailsText(settings.approvedEmails.join('\n'));
      setSuccess('Public access updated.');
    } catch {
      setError('Unable to save public access settings');
    } finally {
      setBusy(false);
    }
  }

  async function copyPublicUrl(): Promise<void> {
    if (!publicAccess?.publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicAccess.publicUrl);
      setSuccess('Public link copied.');
    } catch {
      setError('Unable to copy link.');
    }
  }

  function updateEndField(index: number, patch: Partial<EndFormField>): void {
    setEndFormFields((prev) => prev.map((field, idx) => (idx === index ? { ...field, ...patch } : field)));
  }

  function isOptionFieldType(typeValue: string): boolean {
    return ['dropdown', 'radio', 'checkbox', 'country'].includes(typeValue);
  }

  function fieldOptionsToText(field: EndFormField): string {
    return Array.isArray(field.options) ? field.options.join(', ') : '';
  }

  function getFieldOptionsInputValue(field: EndFormField): string {
    if (typeof field.optionsInput === 'string') {
      return field.optionsInput;
    }
    return fieldOptionsToText(field);
  }

  function textToFieldOptions(raw: string): string[] {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  function normalizeFieldOptionsInput(raw: string): string {
    return textToFieldOptions(raw).join(', ');
  }

  function normalizeFieldKey(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function prettifyFieldKeyLabel(raw: string): string {
    const cleaned = raw
      .trim()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
    if (!cleaned) {
      return '';
    }
    return cleaned
      .split(' ')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  function getFieldKeySuggestion(typeValue: string, index: number): string {
    const n = index + 1;
    switch (typeValue) {
      case 'name':
        return n > 1 ? `full_name_${n}` : 'full_name';
      case 'email':
        return n > 1 ? `email_${n}` : 'email';
      case 'phone':
        return n > 1 ? `phone_${n}` : 'phone';
      case 'url':
        return n > 1 ? `website_url_${n}` : 'website_url';
      case 'country':
        return n > 1 ? `country_${n}` : 'country';
      case 'date':
        return n > 1 ? `event_date_${n}` : 'event_date';
      case 'time':
        return n > 1 ? `event_time_${n}` : 'event_time';
      case 'rating':
        return n > 1 ? `rating_${n}` : 'rating';
      case 'number':
        return n > 1 ? `number_${n}` : 'number';
      case 'text':
        return n > 1 ? `custom_field_${n}` : 'custom_field';
      case 'short_text':
        return n > 1 ? `short_answer_${n}` : 'short_answer';
      case 'long_text':
        return n > 1 ? `long_answer_${n}` : 'long_answer';
      case 'media':
        return n > 1 ? `media_url_${n}` : 'media_url';
      case 'dropdown':
        return n > 1 ? `selection_${n}` : 'selection';
      case 'radio':
        return n > 1 ? `choice_${n}` : 'choice';
      case 'checkbox':
        return n > 1 ? `choices_${n}` : 'choices';
      default:
        return n > 1 ? `field_${n}` : 'field';
    }
  }

  function getFieldPlaceholderSuggestion(typeValue: string, keyValue: string, index: number): string {
    switch (typeValue) {
      case 'name':
        return 'Enter your full name';
      case 'email':
        return 'you@example.com';
      case 'phone':
        return '+383 44 123 456';
      case 'url':
        return 'https://example.com';
      case 'country':
        return 'Select country';
      case 'date':
        return 'Pick a date';
      case 'time':
        return 'Pick a time';
      case 'rating':
        return 'Rate from 1 to 5';
      case 'number':
        return 'Enter a number';
      case 'text':
        return 'Enter value';
      case 'short_text':
        return 'Type a short answer';
      case 'long_text':
        return 'Type your answer here';
      case 'media':
        return 'Paste media URL';
      case 'dropdown':
      case 'radio':
      case 'checkbox':
        return 'Choose an option';
      default: {
        const pretty = prettifyFieldKeyLabel(keyValue || getFieldKeySuggestion(typeValue, index));
        return pretty ? `Enter ${pretty.toLowerCase()}` : 'Enter value';
      }
    }
  }

  function applySmartFieldDefaults(index: number, patch: Partial<EndFormField>): void {
    setEndFormFields((prev) =>
      prev.map((field, idx) => {
        if (idx !== index) {
          return field;
        }
        const next = { ...field, ...patch };
        if (patch.type && !patch.key) {
          next.key = getFieldKeySuggestion(patch.type, idx);
        }
        if (!next.label?.trim()) {
          next.label = prettifyFieldKeyLabel(next.key || getFieldKeySuggestion(next.type, idx)) || `Field ${idx + 1}`;
        }
        if (!next.placeholder?.trim()) {
          next.placeholder = getFieldPlaceholderSuggestion(next.type, next.key, idx);
        }
        return next;
      })
    );
  }

  function removeEndField(index: number): void {
    setEndFormFields((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addEndField(): void {
    const nextIndex = endFormFields.length + 1;
    setEndFormFields((prev) => [
      ...prev,
      {
        type: 'text',
        key: getFieldKeySuggestion('text', nextIndex - 1),
        label: prettifyFieldKeyLabel(getFieldKeySuggestion('text', nextIndex - 1)),
        placeholder: getFieldPlaceholderSuggestion('text', getFieldKeySuggestion('text', nextIndex - 1), nextIndex - 1),
        required: false
      }
    ]);
  }

  function buildSanitizedEndFields(): Array<{
    type: string;
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
    options: string[];
  }> {
    return endFormFields
      .map((field) => ({
        type: field.type.trim(),
        key: field.key.trim(),
        label: field.label.trim(),
        placeholder: field.placeholder?.trim() || '',
        required: Boolean(field.required),
        options: isOptionFieldType(field.type)
          ? (field.options ?? []).map((option) => option.trim()).filter((option) => option.length > 0)
          : []
      }))
      .filter((field) => field.type && field.key && field.label);
  }

  async function saveEndForm(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/end-form`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: endFormEnabled,
          requireSubmit: endFormRequireSubmit,
          title: endFormTitle,
          description: endFormDescription,
          submitLabel: endFormSubmitLabel,
          fields: buildSanitizedEndFields()
        })
      });
      const payload = (await response.json()) as EndFormSettings | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to save end form');
        return;
      }

      const settings = payload as EndFormSettings;
      setEndFormSettings(settings);
      setSuccess('End form saved.');
      await loadLeadSubmissions();
    } catch {
      setError('Unable to save end form');
    } finally {
      setBusy(false);
    }
  }

  async function saveFormQuestions(): Promise<void> {
    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/end-form`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: true,
          requireSubmit: endFormRequireSubmit,
          title: endFormTitle || 'Form',
          description: endFormDescription || '',
          submitLabel: endFormSubmitLabel || 'Submit',
          fields: buildSanitizedEndFields()
        })
      });
      const payload = (await response.json()) as EndFormSettings | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to save form fields');
        return;
      }
      setEndFormEnabled(true);
      setEndFormSettings(payload as EndFormSettings);
      setSuccess('Form fields saved.');
    } catch {
      setError('Unable to save form fields');
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getTokenOrRedirect();
    if (!token || !quiz) {
      return;
    }

    if (quiz.status !== 'PUBLISHED') {
      setError('Publish the quiz first before assigning.');
      return;
    }

    let targets: Array<{ targetType: string; userId?: string; classId?: string; schoolId?: string }> = [];

    if (assignmentScope === 'STUDENT') {
      if (selectedStudentIds.length !== 1) {
        setError('Select exactly one student for STUDENT scope');
        return;
      }
      targets = [{ targetType: 'USER', userId: selectedStudentIds[0] }];
    } else if (assignmentScope === 'SELECTED_STUDENTS') {
      if (selectedStudentIds.length < 1) {
        setError('Select at least one student');
        return;
      }
      targets = selectedStudentIds.map((userId) => ({ targetType: 'USER', userId }));
    } else if (assignmentScope === 'CLASS') {
      if (selectedClassIds.length !== 1) {
        setError('Select exactly one class for CLASS scope');
        return;
      }
      targets = [{ targetType: 'CLASS', classId: selectedClassIds[0] }];
    } else if (assignmentScope === 'MULTI_CLASS') {
      if (selectedClassIds.length < 1) {
        setError('Select at least one class');
        return;
      }
      targets = selectedClassIds.map((classId) => ({ targetType: 'CLASS', classId }));
    } else {
      targets = [{ targetType: assignmentScope }];
    }

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/quizzes/${quiz.id}/assignments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': orgId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scopeType: assignmentScope,
          startAt: assignmentStartAt ? new Date(assignmentStartAt).toISOString() : undefined,
          endAt: assignmentEndAt ? new Date(assignmentEndAt).toISOString() : undefined,
          attemptLimit:
            typeof assignmentAttemptLimit === 'number' && assignmentAttemptLimit > 0
              ? assignmentAttemptLimit
              : undefined,
          targets
        })
      });

      const payload = (await response.json()) as AssignmentItem | { message?: string };
      if (!response.ok) {
        setError(('message' in payload ? payload.message : null) ?? 'Unable to create assignment');
        return;
      }

      setSuccess('Assignment created successfully.');
      if ('id' in payload) {
        setLatestAssignment(payload as AssignmentItem);
      }
      await loadLatestAssignment();
    } catch {
      setError('Unable to create assignment');
    } finally {
      setBusy(false);
    }
  }

  function toggleInSelection(current: string[], id: string): string[] {
    if (current.includes(id)) {
      return current.filter((item) => item !== id);
    }
    return [...current, id];
  }

  const polishedFieldControlStyle = {
    width: '100%',
    border: '1px solid #d7e0ee',
    borderRadius: 12,
    padding: '0.68rem 0.78rem',
    fontSize: '.93rem',
    lineHeight: 1.25,
    background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
    color: '#0f172a',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.92)'
  } as const;

  const polishedFieldKeyControlStyle = {
    ...polishedFieldControlStyle,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    letterSpacing: '.02em',
    background: 'linear-gradient(180deg, #ffffff, #f6f9ff)'
  } as const;

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p>Loading question builder...</p>
        </section>
      </main>
    );
  }

  if (!quiz) {
    return (
      <main className="auth-shell">
        <section className="glass-card auth-card">
          <p style={{ color: '#b91c1c' }}>{error ?? 'Quiz not found'}</p>
          <Link href={`/dashboard/workspace/${orgId}/quizzes`} className="btn btn-ghost">
            Back to Quizzes
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={{ padding: '1rem 0 2rem' }}>
      <section className="container">
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '.82rem' }}>Professional Question Builder</p>
          <h1 style={{ margin: '.2rem 0', fontFamily: '"Gill Sans", "Avenir Next Condensed", "Trebuchet MS", sans-serif' }}>
            {quiz.title}
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>{quiz.description ?? 'No description'}</p>
          <div className="chip-row">
            <span className="chip">Status: {quiz.status}</span>
            <span className="chip">Content: {quizContentType.replace(/_/g, ' ')}</span>
            <span className="chip">Questions: {quiz.questions?.length ?? 0}</span>
            <span className="chip">Pass Score: {quiz.passScore}%</span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
            <Link href={`/dashboard/workspace/${orgId}/quizzes`} className="btn btn-ghost">
              Back to Quizzes
            </Link>
            {canPreviewQuiz ? (
              <Link href={`/dashboard/workspace/${orgId}/quizzes/${quiz.id}/preview`} className="btn btn-ghost">
                Preview Quiz
              </Link>
            ) : (
              <button className="btn btn-ghost" type="button" disabled>
                Preview Quiz
              </button>
            )}
            {quiz.status === 'DRAFT' ? (
              <button className="btn btn-primary" type="button" onClick={() => void publishQuiz()} disabled={busy}>
                Publish Quiz
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container" style={{ marginBottom: '1rem' }}>
        <div className="glass-card" style={{ padding: '.65rem' }}>
          <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
            {([
              { key: 'QUESTIONS', label: 'Questions' },
              { key: 'DESIGN', label: 'Design + Theme' },
              { key: 'ASSIGNMENT', label: 'Assignment' },
              { key: 'ACCESS', label: 'Access + QR' },
              { key: 'END_FORM', label: 'End Form' },
              { key: 'INSIGHTS', label: 'Insights' }
            ] as Array<{ key: BuilderTab; label: string }>)
              .filter((tab) => !(quizContentType === 'FORM' && tab.key === 'END_FORM'))
              .map((tab) => {
              const needsPublished = tab.key === 'ASSIGNMENT' || tab.key === 'ACCESS' || tab.key === 'END_FORM' || tab.key === 'INSIGHTS';
              const disabled = needsPublished && quiz.status !== 'PUBLISHED';
              return (
                <button
                  key={tab.key}
                  className={activeBuilderTab === tab.key ? 'btn btn-primary' : 'btn btn-ghost'}
                  type="button"
                  onClick={() => setActiveBuilderTab(tab.key)}
                  disabled={disabled}
                  title={disabled ? 'Publish quiz to enable this tab' : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1', display: activeBuilderTab === 'DESIGN' ? 'block' : 'none' }}>
            <h3 style={{ marginTop: 0 }}>Quiz Settings</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Control how students see questions and whether they get red/green answer feedback after submit.
            </p>
            <div style={{ display: 'grid', gap: '.65rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="questionFlowMode">Question display mode</label>
                <select
                  id="questionFlowMode"
                  value={quizFlowMode}
                  onChange={(event) => setQuizFlowMode(event.target.value as QuizFlowMode)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value="STEP_BY_STEP">Step by step (one question at a time)</option>
                  <option value="ALL_AT_ONCE">All questions on one page</option>
                </select>
              </div>
              <label
                className="field"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '.72rem .8rem',
                  background: 'rgba(255,255,255,.75)'
                }}
              >
                <span style={{ fontWeight: 600 }}>Show red/green correct answer feedback</span>
                <input
                  type="checkbox"
                  checked={showAnswerFeedback}
                  onChange={(event) => setShowAnswerFeedback(event.target.checked)}
                />
              </label>
            </div>
            <div style={{ marginTop: '.7rem', display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" type="button" onClick={() => void saveQuizSettings()} disabled={busy}>
                {busy ? 'Saving...' : 'Save Quiz Settings'}
              </button>
            </div>
          </article>

          <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1', display: activeBuilderTab === 'DESIGN' ? 'block' : 'none' }}>
            <h3 style={{ marginTop: 0 }}>Start Page</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Optional intro screen before quiz starts. Default is off so public users go directly to the quiz.
            </p>
            <div style={{ display: 'grid', gap: '.65rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label
                className="field"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '.72rem .8rem',
                  background: 'rgba(255,255,255,.75)'
                }}
              >
                <span style={{ fontWeight: 600 }}>Enable start page</span>
                <input
                  type="checkbox"
                  checked={startScreenConfig.enabled}
                  onChange={(event) =>
                    setStartScreenConfig((prev) => ({
                      ...prev,
                      enabled: event.target.checked
                    }))
                  }
                />
              </label>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="startScreenMode">Start page style</label>
                <select
                  id="startScreenMode"
                  value={startScreenConfig.mode}
                  onChange={(event) =>
                    setStartScreenConfig((prev) => ({
                      ...prev,
                      mode: event.target.value as 'DEFAULT' | 'CUSTOM'
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
                  <option value="DEFAULT">Default (use quiz title/description)</option>
                  <option value="CUSTOM">Custom intro content</option>
                </select>
              </div>
              <label
                className="field"
                style={{
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  padding: '.72rem .8rem',
                  background: 'rgba(255,255,255,.75)'
                }}
              >
                <span style={{ fontWeight: 600 }}>Show glass-card on start page</span>
                <input
                  type="checkbox"
                  checked={startScreenConfig.showGlassCard}
                  onChange={(event) =>
                    setStartScreenConfig((prev) => ({
                      ...prev,
                      showGlassCard: event.target.checked
                    }))
                  }
                />
              </label>
            </div>

            {startScreenConfig.mode === 'CUSTOM' ? (
              <div style={{ display: 'grid', gap: '.65rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '.65rem' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="startScreenTitle">Title</label>
                  <input
                    id="startScreenTitle"
                    value={startScreenConfig.title}
                    onChange={(event) =>
                      setStartScreenConfig((prev) => ({
                        ...prev,
                        title: event.target.value
                      }))
                    }
                    placeholder="Welcome to this quiz"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="startScreenButtonLabel">Button label</label>
                  <input
                    id="startScreenButtonLabel"
                    value={startScreenConfig.buttonLabel}
                    onChange={(event) =>
                      setStartScreenConfig((prev) => ({
                        ...prev,
                        buttonLabel: event.target.value
                      }))
                    }
                    placeholder="Start Quiz"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor="startScreenCoverImage">Cover image URL (optional)</label>
                  <input
                    id="startScreenCoverImage"
                    value={startScreenConfig.coverImageUrl}
                    onChange={(event) =>
                      setStartScreenConfig((prev) => ({
                        ...prev,
                        coverImageUrl: event.target.value
                      }))
                    }
                    placeholder="https://example.com/cover.jpg"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label htmlFor="startScreenDescription">Description</label>
                  <textarea
                    id="startScreenDescription"
                    rows={3}
                    value={startScreenConfig.description}
                    onChange={(event) =>
                      setStartScreenConfig((prev) => ({
                        ...prev,
                        description: event.target.value
                      }))
                    }
                    placeholder="Short intro text before the first question."
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
                <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label>Rich intro content</label>
                  <div
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      background: '#fff',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '.35rem',
                        padding: '.55rem',
                        borderBottom: '1px solid var(--line)',
                        background: '#f8fafc'
                      }}
                    >
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('formatBlock', 'H1')}>
                        H1
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('formatBlock', 'H2')}>
                        H2
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('formatBlock', 'P')}>
                        Text
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('bold')}>
                        Bold
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('italic')}>
                        Italic
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('underline')}>
                        Underline
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('insertUnorderedList')}>
                        Bullet
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('insertOrderedList')}>
                        Numbered
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => applyStartIntroCommand('createLink')}>
                        Link
                      </button>
                      <select
                        defaultValue="3"
                        onChange={(event) => applyStartIntroCommand('fontSize', event.target.value)}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: 10,
                          padding: '.45rem .55rem',
                          background: '#fff',
                          minWidth: 110
                        }}
                      >
                        <option value="2">Small</option>
                        <option value="3">Normal</option>
                        <option value="4">Large</option>
                        <option value="5">XL</option>
                      </select>
                    </div>
                    <div
                      ref={startIntroEditorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={onStartIntroInput}
                      style={{
                        minHeight: 160,
                        padding: '.75rem .85rem',
                        outline: 'none',
                        fontSize: '.97rem',
                        lineHeight: 1.6
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: '.7rem', display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" type="button" onClick={() => void saveStartScreenConfig()} disabled={busy}>
                {busy ? 'Saving...' : 'Save Start Page'}
              </button>
            </div>
          </article>

          <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1', display: activeBuilderTab === 'DESIGN' ? 'block' : 'none' }}>
            <h3 style={{ marginTop: 0 }}>Theme and Branding</h3>
            <p style={{ marginTop: 0, color: 'var(--muted)' }}>
              Customize quiz colors and typography for students/public players.
            </p>
            <div style={{ display: 'grid', gap: '.65rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Background Color</label>
                <input type="color" value={quizTheme.backgroundColor} onChange={(event) => updateTheme('backgroundColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Card Color</label>
                <input type="color" value={quizTheme.cardColor} onChange={(event) => updateTheme('cardColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Text Color</label>
                <input type="color" value={quizTheme.textColor} onChange={(event) => updateTheme('textColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Primary Button</label>
                <input type="color" value={quizTheme.primaryColor} onChange={(event) => updateTheme('primaryColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Correct Color</label>
                <input type="color" value={quizTheme.correctColor} onChange={(event) => updateTheme('correctColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Wrong Color</label>
                <input type="color" value={quizTheme.wrongColor} onChange={(event) => updateTheme('wrongColor', event.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Font Family</label>
                <select
                  value={quizTheme.fontFamily}
                  onChange={(event) => updateTheme('fontFamily', event.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value='"Avenir Next", "Segoe UI", sans-serif'>Avenir Next</option>
                  <option value='"Trebuchet MS", "Segoe UI", sans-serif'>Trebuchet</option>
                  <option value='"Georgia", serif'>Georgia</option>
                  <option value='"Verdana", "Segoe UI", sans-serif'>Verdana</option>
                  <option value='"Poppins", "Segoe UI", sans-serif'>Poppins</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                <label>Background Gradient (optional CSS)</label>
                <input
                  value={quizTheme.backgroundGradient}
                  onChange={(event) => updateTheme('backgroundGradient', event.target.value)}
                  placeholder="linear-gradient(135deg, #f3f6ff 0%, #eef8ff 50%, #f9f4ff 100%)"
                />
              </div>
            </div>
            <div style={{ marginTop: '.75rem', display: 'flex', gap: '.5rem' }}>
              <button className="btn btn-primary" type="button" onClick={() => void saveQuizTheme()} disabled={busy}>
                {busy ? 'Saving...' : 'Save Theme'}
              </button>
            </div>

            <div
              className="glass-card"
              style={{
                marginTop: '.8rem',
                padding: '.8rem',
                background: quizTheme.backgroundGradient || quizTheme.backgroundColor,
                color: quizTheme.textColor,
                fontFamily: quizTheme.fontFamily
              }}
            >
              <p style={{ margin: 0, color: quizTheme.mutedTextColor, fontSize: '.82rem' }}>Live Preview</p>
              <h4 style={{ margin: '.25rem 0 .45rem' }}>How the player will look</h4>
              {quizContentType === 'PREDICTOR' ? (
                <div
                  style={{
                    background: '#111827',
                    borderRadius: 20,
                    padding: '1rem',
                    border: '1px solid #2a3a52',
                    color: '#e2e8f0'
                  }}
                >
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
                  <h4 style={{ margin: '.55rem 0 .7rem', color: '#f8fafc' }}>{predictorConfig.titleText}</h4>
                  <div style={{ display: 'grid', gap: '.55rem', gridTemplateColumns: '1fr auto 1fr', alignItems: 'stretch' }}>
                    {[{ side: 'left', name: predictorConfig.leftTeamName, score: predictorConfig.leftScore, logo: predictorConfig.leftTeamLogoUrl }, { side: 'right', name: predictorConfig.rightTeamName, score: predictorConfig.rightScore, logo: predictorConfig.rightTeamLogoUrl }].map((team) => (
                      <div
                        key={team.side}
                        style={{
                          borderRadius: 12,
                          padding: '.7rem .65rem',
                          background: '#0b1220',
                          border: '1px solid #27354a'
                        }}
                      >
                        {team.logo ? (
                          <img
                            src={team.logo}
                            alt={team.name}
                            style={{ width: 66, height: 66, objectFit: 'cover', borderRadius: 999, display: 'block', margin: '0 auto .45rem' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 66,
                              height: 66,
                              borderRadius: 999,
                              border: '2px solid #334155',
                              display: 'grid',
                              placeItems: 'center',
                              margin: '0 auto .45rem',
                              color: '#94a3b8',
                              fontSize: '.7rem',
                              fontWeight: 700,
                              textAlign: 'center',
                              lineHeight: 1.1
                            }}
                          >
                            ADD
                            <br />
                            LOGO
                          </div>
                        )}
                        <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700 }}>{team.name}</p>
                        <div style={{ marginTop: '.55rem', display: 'grid', gridTemplateColumns: '28px 1fr 28px', gap: '.35rem', alignItems: 'center' }}>
                          <div style={{ width: 28, height: 28, borderRadius: 999, background: '#ffffff', color: '#0f172a', fontWeight: 800, display: 'grid', placeItems: 'center' }}>-</div>
                          <div style={{ border: '1px solid #475569', borderRadius: 10, textAlign: 'center', padding: '.25rem 0', fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
                            {team.score}
                          </div>
                          <div style={{ width: 28, height: 28, borderRadius: 999, background: '#ffffff', color: '#0f172a', fontWeight: 800, display: 'grid', placeItems: 'center' }}>+</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ alignSelf: 'center', color: '#94a3b8', fontWeight: 800, width: 38, height: 38, borderRadius: 999, border: '1px solid #475569', display: 'grid', placeItems: 'center' }}>
                      VS
                    </div>
                  </div>
                </div>
              ) : previewQuestion ? (
                <div style={{ background: quizTheme.cardColor, borderRadius: 12, padding: '.75rem', border: '1px solid var(--line)' }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{previewQuestion.prompt}</p>
                  {previewQuestion.explanation ? (
                    <p style={{ margin: '.35rem 0 0', color: quizTheme.mutedTextColor, fontSize: '.86rem' }}>
                      {previewQuestion.explanation}
                    </p>
                  ) : null}

                  {previewQuestion.type === 'SHORT_TEXT' ? (
                    <div
                      style={{
                        marginTop: '.65rem',
                        border: '1px solid var(--line)',
                        borderRadius: 10,
                        padding: '.6rem .7rem',
                        color: quizTheme.mutedTextColor,
                        background: '#fff'
                      }}
                    >
                      Student short-text answer...
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '.45rem', marginTop: '.65rem' }}>
                      {previewQuestion.options.map((option, idx) => {
                        const isCorrect = idx === previewCorrectOptionIndex && previewCorrectOptionIndex >= 0;
                        const isWrongSelected = idx === previewWrongOptionIndex && previewWrongOptionIndex >= 0 && !isCorrect;
                        return (
                          <div
                            key={`${option.label}-${idx}`}
                            style={{
                              border: `1px solid ${
                                isCorrect ? quizTheme.correctColor : isWrongSelected ? quizTheme.wrongColor : 'var(--line)'
                              }`,
                              borderRadius: 10,
                              padding: '.5rem .6rem',
                              background:
                                isCorrect
                                  ? `${quizTheme.correctColor}22`
                                  : isWrongSelected
                                    ? `${quizTheme.wrongColor}22`
                                    : '#fff'
                            }}
                          >
                            {option.label}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center', marginTop: '.7rem' }}>
                    <span style={{ color: quizTheme.mutedTextColor, fontSize: '.82rem' }}>Question 1 of 10</span>
                    <button
                      className="btn"
                      type="button"
                      style={{
                        background: quizTheme.primaryColor,
                        color: quizTheme.primaryTextColor,
                        border: 'none'
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ background: quizTheme.cardColor, borderRadius: 12, padding: '.7rem', border: '1px solid var(--line)' }}>
                  <p style={{ margin: 0, color: quizTheme.mutedTextColor }}>Add at least one question to see live preview.</p>
                </div>
              )}
            </div>
          </article>

          <article className="glass-card" style={{ padding: '1rem', display: activeBuilderTab === 'QUESTIONS' ? 'block' : 'none' }}>
            <h3 style={{ marginTop: 0 }}>
              {quizContentType === 'FORM'
                ? 'Form Fields'
                : quizContentType === 'PREDICTOR'
                  ? 'Predictor Setup'
                  : editingQuestionId
                    ? 'Edit Question'
                    : 'Add Question'}
            </h3>
            {quizContentType === 'FORM' ? (
              <>
                <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                  Build form questions here. This replaces End Form configuration for FORM content.
                </p>
                <div
                  className="glass-card"
                  style={{
                    padding: '.8rem',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(246,249,255,.9))'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>Field Builder</strong>
                      <p style={{ margin: '.2rem 0 0', color: 'var(--muted)', fontSize: '.84rem' }}>
                        Design the exact input structure shown to users.
                      </p>
                    </div>
                    <span className="chip">Fields: {endFormFields.length}</span>
                  </div>

                  <div style={{ display: 'grid', gap: '.8rem', marginTop: '.75rem' }}>
                  {endFormFields.map((field, idx) => (
                    <div
                      key={`${field.key}-${idx}`}
                      className="glass-card"
                      style={{
                        padding: '.8rem',
                        border: '1px solid var(--line)',
                        borderRadius: 16,
                        background: 'linear-gradient(180deg, #ffffff, #f8fbff)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center', marginBottom: '.65rem' }}>
                        <div style={{ display: 'grid', gap: '.12rem' }}>
                          <strong style={{ fontSize: '.95rem' }}>Field #{idx + 1}</strong>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem' }}>
                            Key: <code>{field.key || `field_${idx + 1}`}</code>
                          </small>
                        </div>
                        <span className="chip" style={{ fontSize: '.72rem', letterSpacing: '.02em' }}>
                          {field.type.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: '.55rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                        <div style={{ display: 'grid', gap: '.22rem' }}>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>TYPE</small>
                          <select
                            value={field.type}
                            onChange={(event) => applySmartFieldDefaults(idx, { type: event.target.value })}
                            style={polishedFieldControlStyle}
                          >
                            {FORM_FIELD_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div style={{ display: 'grid', gap: '.22rem' }}>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>FIELD KEY</small>
                          <input
                            value={field.key}
                            onChange={(event) => updateEndField(idx, { key: event.target.value })}
                            onBlur={(event) => applySmartFieldDefaults(idx, { key: normalizeFieldKey(event.target.value) })}
                            placeholder={getFieldKeySuggestion(field.type, idx)}
                            style={polishedFieldKeyControlStyle}
                          />
                          <small style={{ color: 'var(--muted)', fontSize: '.7rem' }}>Use lowercase `snake_case` keys</small>
                        </div>
                        <div style={{ display: 'grid', gap: '.22rem' }}>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>LABEL</small>
                          <input
                            value={field.label}
                            onChange={(event) => updateEndField(idx, { label: event.target.value })}
                            placeholder={prettifyFieldKeyLabel(field.key || getFieldKeySuggestion(field.type, idx)) || 'Field label'}
                            style={polishedFieldControlStyle}
                          />
                        </div>
                        <div style={{ display: 'grid', gap: '.22rem' }}>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>PLACEHOLDER</small>
                          <input
                            value={field.placeholder ?? ''}
                            onChange={(event) => updateEndField(idx, { placeholder: event.target.value })}
                            placeholder={getFieldPlaceholderSuggestion(field.type, field.key, idx)}
                            style={polishedFieldControlStyle}
                          />
                        </div>
                      </div>
                      {isOptionFieldType(field.type) ? (
                        <div style={{ marginTop: '.55rem', display: 'grid', gap: '.22rem' }}>
                          <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>OPTIONS</small>
                          <input
                            value={getFieldOptionsInputValue(field)}
                            onChange={(event) =>
                              updateEndField(idx, { optionsInput: event.target.value, options: textToFieldOptions(event.target.value) })
                            }
                            onBlur={(event) =>
                              updateEndField(idx, {
                                optionsInput: normalizeFieldOptionsInput(event.target.value),
                                options: textToFieldOptions(event.target.value)
                              })
                            }
                            placeholder="Options (comma separated), e.g. Yes, No"
                            style={polishedFieldControlStyle}
                          />
                        </div>
                      ) : null}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.65rem' }}>
                        <label
                          style={{
                            display: 'inline-flex',
                            gap: '.4rem',
                            alignItems: 'center',
                            fontSize: '.88rem',
                            border: '1px solid var(--line)',
                            borderRadius: 999,
                            padding: '.25rem .55rem',
                            background: 'rgba(248,250,252,.8)'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(event) => updateEndField(idx, { required: event.target.checked })}
                          />
                          Required
                        </label>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => removeEndField(idx)}
                          style={{ borderRadius: 12, borderColor: '#fecaca', color: '#b91c1c', background: '#fff5f5' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div
                  className="glass-card"
                  style={{
                    display: 'flex',
                    gap: '.5rem',
                    marginTop: '.75rem',
                    flexWrap: 'wrap',
                    padding: '.65rem',
                    borderRadius: 14,
                    border: '1px solid var(--line)',
                    background: 'rgba(255,255,255,.92)'
                  }}
                >
                  <button className="btn btn-ghost" type="button" onClick={addEndField} style={{ borderRadius: 12 }}>
                    Add Field
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => void saveFormQuestions()} disabled={busy} style={{ borderRadius: 12 }}>
                    {busy ? 'Saving...' : 'Save Form Fields'}
                  </button>
                </div>
                {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
                {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
              </>
            ) : quizContentType === 'PREDICTOR' ? (
              <>
                <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                  Configure the score prediction card shown to users.
                </p>
                <div className="glass-card" style={{ padding: '.9rem', borderRadius: 18, border: '1px solid var(--line)' }}>
                  <div style={{ display: 'grid', gap: '.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                    <div style={{ display: 'grid', gap: '.55rem', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Badge text</label>
                      <input
                        value={predictorConfig.badgeText}
                        onChange={(event) => updatePredictorConfig('badgeText', event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Title</label>
                      <input
                        value={predictorConfig.titleText}
                        onChange={(event) => updatePredictorConfig('titleText', event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Team 1 Name</label>
                      <input
                        value={predictorConfig.leftTeamName}
                        onChange={(event) => updatePredictorConfig('leftTeamName', event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Team 2 Name</label>
                      <input
                        value={predictorConfig.rightTeamName}
                        onChange={(event) => updatePredictorConfig('rightTeamName', event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Team 1 Logo URL (optional)</label>
                      <input
                        value={predictorConfig.leftTeamLogoUrl}
                        onChange={(event) => updatePredictorConfig('leftTeamLogoUrl', event.target.value)}
                        placeholder="https://..."
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Team 2 Logo URL (optional)</label>
                      <input
                        value={predictorConfig.rightTeamLogoUrl}
                        onChange={(event) => updatePredictorConfig('rightTeamLogoUrl', event.target.value)}
                        placeholder="https://..."
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Min score</label>
                      <input
                        type="number"
                        value={predictorConfig.minScore}
                        onChange={(event) => updatePredictorConfig('minScore', Number(event.target.value || 0))}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Max score</label>
                      <input
                        type="number"
                        value={predictorConfig.maxScore}
                        onChange={(event) => updatePredictorConfig('maxScore', Number(event.target.value || 0))}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Step</label>
                      <input
                        type="number"
                        min={1}
                        value={predictorConfig.step}
                        onChange={(event) => updatePredictorConfig('step', Math.max(1, Number(event.target.value || 1)))}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Default Team 1 score</label>
                      <input
                        type="number"
                        value={predictorConfig.leftScore}
                        onChange={(event) => updatePredictorConfig('leftScore', Number(event.target.value || 0))}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Default Team 2 score</label>
                      <input
                        type="number"
                        value={predictorConfig.rightScore}
                        onChange={(event) => updatePredictorConfig('rightScore', Number(event.target.value || 0))}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    </div>

                    <div
                      style={{
                        background: '#111827',
                        borderRadius: 18,
                        padding: '.9rem',
                        border: '1px solid #2a3a52',
                        color: '#e2e8f0'
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          borderRadius: 999,
                          background: '#030712',
                          color: '#f8fafc',
                          padding: '.2rem .55rem',
                          fontSize: '.7rem',
                          fontWeight: 700,
                          letterSpacing: '.08em'
                        }}
                      >
                        {predictorConfig.badgeText}
                      </span>
                      <h4 style={{ margin: '.55rem 0 .7rem', color: '#f8fafc' }}>{predictorConfig.titleText}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '.5rem', alignItems: 'stretch' }}>
                        {[{ key: 'left', name: predictorConfig.leftTeamName, score: predictorConfig.leftScore, logo: predictorConfig.leftTeamLogoUrl }, { key: 'right', name: predictorConfig.rightTeamName, score: predictorConfig.rightScore, logo: predictorConfig.rightTeamLogoUrl }].map((team) => (
                          <div key={team.key} style={{ borderRadius: 12, background: '#0b1220', border: '1px solid #27354a', padding: '.55rem' }}>
                            {team.logo ? (
                              <img
                                src={team.logo}
                                alt={team.name}
                                style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 999, display: 'block', margin: '0 auto .4rem' }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 999,
                                  border: '2px solid #334155',
                                  display: 'grid',
                                  placeItems: 'center',
                                  margin: '0 auto .4rem',
                                  color: '#94a3b8',
                                  fontSize: '.62rem',
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
                            <p style={{ margin: 0, textAlign: 'center', color: '#cbd5e1', fontWeight: 700, fontSize: '.84rem' }}>{team.name}</p>
                            <div style={{ marginTop: '.45rem', display: 'grid', gridTemplateColumns: '24px 1fr 24px', gap: '.25rem', alignItems: 'center' }}>
                              <div style={{ width: 24, height: 24, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>-</div>
                              <div style={{ border: '1px solid #475569', borderRadius: 10, textAlign: 'center', padding: '.15rem 0', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                {team.score}
                              </div>
                              <div style={{ width: 24, height: 24, borderRadius: 999, background: '#fff', color: '#111827', fontWeight: 800, display: 'grid', placeItems: 'center' }}>+</div>
                            </div>
                          </div>
                        ))}
                        <div style={{ alignSelf: 'center', width: 34, height: 34, borderRadius: 999, border: '1px solid #475569', display: 'grid', placeItems: 'center', color: '#94a3b8', fontWeight: 800 }}>
                          VS
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '.75rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" type="button" onClick={() => void savePredictorConfig()} disabled={busy}>
                      {busy ? 'Saving...' : 'Save Predictor'}
                    </button>
                  </div>
                </div>
                {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
                {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}
              </>
            ) : (
              <form onSubmit={saveQuestion}>
              <div className="field">
                <label htmlFor="type">Question type</label>
                <select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as QuestionType)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value="SINGLE_CHOICE">Single Choice</option>
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="TRUE_FALSE">True / False</option>
                  <option value="SHORT_TEXT">Short Text</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="prompt">Prompt</label>
                <input id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="explanation">Explanation (optional)</label>
                <input id="explanation" value={explanation} onChange={(event) => setExplanation(event.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="questionImageUrl">Question image URL (optional)</label>
                <input
                  id="questionImageUrl"
                  value={questionImageUrl}
                  onChange={(event) => setQuestionImageUrl(event.target.value)}
                  placeholder="https://example.com/lion.jpg"
                />
                <div style={{ marginTop: '.45rem', display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="file" accept="image/*" onChange={handleQuestionImageFile} />
                  <small style={{ color: 'var(--muted)' }}>Or upload image (up to 1MB for now)</small>
                </div>
                {questionImageUrl ? (
                  <div style={{ marginTop: '.55rem' }}>
                    <img
                      src={questionImageUrl}
                      alt="Question preview"
                      style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, border: '1px solid var(--line)' }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="points">Points</label>
                <input
                  id="points"
                  type="number"
                  min={1}
                  value={points}
                  onChange={(event) => setPoints(Number(event.target.value || 1))}
                />
              </div>

              {isChoiceType ? (
                <div className="field">
                  <label>Answer options</label>
                  <div style={{ display: 'grid', gap: '.5rem' }}>
                    {options.map((option, idx) => (
                      <div
                        key={option.id ?? `option-${idx}`}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '.4rem' }}
                      >
                        <input
                          value={option.label}
                          onChange={(event) => updateOption(idx, { label: event.target.value })}
                          placeholder="Label"
                        />
                        <input
                          value={option.value}
                          onChange={(event) => updateOption(idx, { value: event.target.value })}
                          placeholder="Value"
                        />
                        <button type="button" className="btn btn-ghost" onClick={() => markCorrect(idx)}>
                          {option.isCorrect ? 'Correct' : 'Mark'}
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => removeOption(idx)}>
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost" onClick={addOption}>
                      Add Option
                    </button>
                  </div>
                </div>
              ) : null}

              {type === 'TRUE_FALSE' ? (
                <div className="field">
                  <label>Correct answer</label>
                  <select
                    value={trueFalseCorrect}
                    onChange={(event) => setTrueFalseCorrect(event.target.value as 'TRUE' | 'FALSE')}
                    style={{
                      width: '100%',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '0.72rem 0.8rem',
                      fontSize: '.95rem',
                      background: '#fff'
                    }}
                  >
                    <option value="TRUE">True</option>
                    <option value="FALSE">False</option>
                  </select>
                </div>
              ) : null}

              {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
              {success ? <p style={{ color: '#065f46' }}>{success}</p> : null}

              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy
                    ? 'Saving...'
                    : editingQuestionId
                      ? 'Update Question'
                      : `Add Question #${nextPosition}`}
                </button>
                {editingQuestionId ? (
                  <button className="btn btn-ghost" type="button" onClick={resetQuestionForm}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
              </form>
            )}
          </article>

          <article className="glass-card" style={{ padding: '1rem', gridColumn: 'span 2', display: activeBuilderTab === 'QUESTIONS' ? 'block' : 'none' }}>
            <h3 style={{ marginTop: 0 }}>
              {quizContentType === 'FORM' ? 'Form Field Outline' : quizContentType === 'PREDICTOR' ? 'Predictor Outline' : 'Question Outline'}
            </h3>
            {quizContentType === 'FORM' ? (
              endFormFields.length > 0 ? (
                <div style={{ display: 'grid', gap: '.55rem' }}>
                  {endFormFields.map((field, idx) => (
                    <div key={`${field.key}-${idx}`} className="glass-card" style={{ padding: '.65rem' }}>
                      <strong>{field.label || `Field ${idx + 1}`}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '.86rem' }}>
                        {field.type} · key: {field.key || '-'} {field.required ? '· required' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--muted)' }}>No form fields yet. Add fields from the panel.</p>
              )
            ) : quizContentType === 'PREDICTOR' ? (
              <div className="glass-card" style={{ padding: '.8rem' }}>
                <strong>{predictorConfig.titleText}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: '.25rem' }}>
                  {predictorConfig.leftTeamName} vs {predictorConfig.rightTeamName}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.25rem' }}>
                  Range: {predictorConfig.minScore} - {predictorConfig.maxScore} · Step: {predictorConfig.step}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.25rem' }}>
                  Default: {predictorConfig.leftScore} : {predictorConfig.rightScore}
                </div>
              </div>
            ) : quiz.questions && quiz.questions.length > 0 ? (
              <div style={{ display: 'grid', gap: '.6rem' }}>
                {quiz.questions.map((question, index) => (
                  <div key={question.id} className="glass-card" style={{ padding: '.7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                      <strong>
                        Q{question.position}. {question.prompt}
                      </strong>
                      <span style={{ color: 'var(--muted)', fontSize: '.86rem' }}>
                        {question.type} · {question.points} pts
                      </span>
                    </div>
                    {question.metadata?.imageUrl ? (
                      <div style={{ marginTop: '.5rem' }}>
                        <img
                          src={question.metadata.imageUrl}
                          alt={`Question ${question.position}`}
                          style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, border: '1px solid var(--line)' }}
                        />
                      </div>
                    ) : null}
                    {question.answerOptions && question.answerOptions.length > 0 ? (
                      <ul style={{ margin: '.5rem 0 0 1rem', color: 'var(--muted)' }}>
                        {question.answerOptions.map((option, idx) => (
                          <li key={`${question.id}-${idx}`}>
                            {option.label} {option.isCorrect ? '✓' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: 'var(--muted)', marginBottom: 0 }}>No predefined options.</p>
                    )}
                    {quiz.status === 'DRAFT' ? (
                      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.6rem' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => startEditQuestion(question)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void reorderQuestion(question.id, 'up')}
                          disabled={index === 0 || busy}
                        >
                          Move Up
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void reorderQuestion(question.id, 'down')}
                          disabled={index === (quiz.questions?.length ?? 1) - 1 || busy}
                        >
                          Move Down
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void deleteQuestion(question.id)}
                          disabled={busy}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)' }}>No questions yet. Add your first question from the panel.</p>
            )}
          </article>
        </div>
      </section>

      {quiz.status === 'PUBLISHED' ? (
        <section className="container" style={{ marginTop: '1rem' }}>
          <div className="feature-grid">
            <article
              className="glass-card"
              style={{ padding: '1rem', gridColumn: 'span 2', display: activeBuilderTab === 'ASSIGNMENT' ? 'block' : 'none' }}
            >
              <h3 style={{ marginTop: 0 }}>Assignment Flow</h3>
              <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                Assign immediately after publish to class, selected students, school-wide, public/embed, or request-link approval scopes.
              </p>

              <form onSubmit={createAssignment}>
                <div className="field">
                  <label htmlFor="assignmentScope">Scope</label>
                  <select
                    id="assignmentScope"
                    value={assignmentScope}
                    onChange={(event) => setAssignmentScope(event.target.value as AssignmentScope)}
                    style={{
                      width: '100%',
                      border: '1px solid var(--line)',
                      borderRadius: 12,
                      padding: '0.72rem 0.8rem',
                      fontSize: '.95rem',
                      background: '#fff'
                    }}
                  >
                    <option value="STUDENT">One Student</option>
                    <option value="SELECTED_STUDENTS">Selected Students</option>
                    <option value="CLASS">One Class</option>
                    <option value="MULTI_CLASS">Multiple Classes</option>
                    <option value="SCHOOL_WIDE">School-Wide</option>
                    <option value="PUBLIC_LINK">Public Link</option>
                    <option value="EMBED_PUBLIC">Embedded/Public</option>
                    <option value="REQUEST_LINK">Request Link (approval required)</option>
                  </select>
                </div>

                {assignmentScope === 'STUDENT' || assignmentScope === 'SELECTED_STUDENTS' ? (
                  <div className="field">
                    <label>Students</label>
                    <div style={{ display: 'grid', gap: '.35rem', maxHeight: 180, overflow: 'auto', padding: '.45rem', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
                      {studentCandidates.length === 0 ? (
                        <p style={{ color: 'var(--muted)', margin: 0 }}>No active members available.</p>
                      ) : (
                        studentCandidates.map((member) => {
                          const name = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ').trim();
                          const checked = selectedStudentIds.includes(member.user.id);
                          return (
                            <label key={member.user.id} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = toggleInSelection(selectedStudentIds, member.user.id);
                                  setSelectedStudentIds(assignmentScope === 'STUDENT' ? next.slice(-1) : next);
                                }}
                              />
                              <span>
                                {name || member.user.email} <small style={{ color: 'var(--muted)' }}>({member.user.email})</small>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                {assignmentScope === 'CLASS' || assignmentScope === 'MULTI_CLASS' ? (
                  <div className="field">
                    <label>Classes</label>
                    <div style={{ display: 'grid', gap: '.35rem', maxHeight: 180, overflow: 'auto', padding: '.45rem', border: '1px solid var(--line)', borderRadius: 12, background: '#fff' }}>
                      {classes.length === 0 ? (
                        <div>
                          <p style={{ color: 'var(--muted)', margin: 0 }}>No classes found in this organization.</p>
                          <div style={{ marginTop: '.45rem' }}>
                            <Link href={`/dashboard/workspace/${orgId}/classes`} className="btn btn-ghost">
                              Create Class
                            </Link>
                          </div>
                        </div>
                      ) : (
                        classes.map((item) => {
                          const checked = selectedClassIds.includes(item.id);
                          return (
                            <label key={item.id} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = toggleInSelection(selectedClassIds, item.id);
                                  setSelectedClassIds(assignmentScope === 'CLASS' ? next.slice(-1) : next);
                                }}
                              />
                              <span>{item.name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gap: '.6rem', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="assignmentStartAt">Start (optional)</label>
                    <input
                      id="assignmentStartAt"
                      type="datetime-local"
                      value={assignmentStartAt}
                      onChange={(event) => setAssignmentStartAt(event.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="assignmentEndAt">End (optional)</label>
                    <input
                      id="assignmentEndAt"
                      type="datetime-local"
                      value={assignmentEndAt}
                      onChange={(event) => setAssignmentEndAt(event.target.value)}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label htmlFor="assignmentAttemptLimit">Attempt limit (optional)</label>
                    <input
                      id="assignmentAttemptLimit"
                      type="number"
                      min={1}
                      value={assignmentAttemptLimit}
                      onChange={(event) => {
                        if (!event.target.value) {
                          setAssignmentAttemptLimit('');
                          return;
                        }
                        setAssignmentAttemptLimit(Number(event.target.value));
                      }}
                    />
                  </div>
                </div>

                <button className="btn btn-primary" type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Create Assignment'}
                </button>
              </form>

              {latestAssignment?.scopeType === 'REQUEST_LINK' && latestAssignment.requestUrl ? (
                <div style={{ marginTop: '1rem', borderTop: '1px dashed var(--line)', paddingTop: '.8rem' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '.4rem' }}>Request Link</h4>
                  <div className="glass-card" style={{ padding: '.55rem', borderRadius: 12 }}>
                    <p style={{ margin: 0, fontSize: '.8rem', wordBreak: 'break-all' }}>{latestAssignment.requestUrl}</p>
                  </div>
                  <div style={{ marginTop: '.45rem', display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(latestAssignment.requestUrl ?? '')}
                    >
                      Copy Request Link
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => void loadAssignmentRequests(latestAssignment.id)}>
                      Refresh Requests
                    </button>
                  </div>

                  <div style={{ marginTop: '.7rem' }}>
                    <h4 style={{ marginTop: 0, marginBottom: '.45rem' }}>Pending/Reviewed Requests</h4>
                    {assignmentRequests.length === 0 ? (
                      <p style={{ margin: 0, color: 'var(--muted)' }}>No requests yet.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '.45rem' }}>
                        {assignmentRequests.map((request) => (
                          <div
                            key={request.id}
                            className="glass-card"
                            style={{ padding: '.6rem', display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}
                          >
                            <div>
                              <strong>{request.name}</strong>{' '}
                              <span style={{ color: 'var(--muted)', fontSize: '.88rem' }}>({request.email})</span>
                              <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                                {request.status} · {new Date(request.requestedAt).toLocaleString()}
                              </div>
                            </div>
                            {request.status === 'PENDING' ? (
                              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-primary"
                                  type="button"
                                  onClick={() => void reviewAssignmentRequest(latestAssignment.id, request.id, 'approve')}
                                  disabled={busy}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => void reviewAssignmentRequest(latestAssignment.id, request.id, 'reject')}
                                  disabled={busy}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </article>

            <article className="glass-card" style={{ padding: '1rem', display: activeBuilderTab === 'ACCESS' ? 'block' : 'none' }}>
              <h3 style={{ marginTop: 0 }}>Public Link and QR</h3>
              <div className="field">
                <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={publicAccessEnabled}
                    onChange={(event) => setPublicAccessEnabled(event.target.checked)}
                  />
                  Enable public access
                </label>
              </div>

              <div className="field">
                <label htmlFor="publicMode">Access mode</label>
                <select
                  id="publicMode"
                  value={publicAccessMode}
                  onChange={(event) => setPublicAccessMode(event.target.value as PublicAccessMode)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '0.72rem 0.8rem',
                    fontSize: '.95rem',
                    background: '#fff'
                  }}
                >
                  <option value="PUBLIC_LINK">Public link (anyone with URL)</option>
                  <option value="PASSWORD">Password protected</option>
                  <option value="APPROVAL">Approved email list</option>
                </select>
              </div>

              {publicAccessMode === 'PASSWORD' ? (
                <div className="field">
                  <label htmlFor="publicPassword">Password (min 4 chars)</label>
                  <input
                    id="publicPassword"
                    type="password"
                    placeholder="Set or update password"
                    value={publicPassword}
                    onChange={(event) => setPublicPassword(event.target.value)}
                  />
                </div>
              ) : null}

              {publicAccessMode === 'APPROVAL' ? (
                <div className="field">
                  <label htmlFor="approvedEmails">Approved emails (comma or newline separated)</label>
                  <textarea
                    id="approvedEmails"
                    value={approvedEmailsText}
                    onChange={(event) => setApprovedEmailsText(event.target.value)}
                    rows={6}
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
              ) : null}

              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" type="button" onClick={() => void savePublicAccess()} disabled={busy}>
                  {busy ? 'Saving...' : 'Save Public Access'}
                </button>
                {publicAccess?.publicUrl ? (
                  <button className="btn btn-ghost" type="button" onClick={() => void copyPublicUrl()}>
                    Copy Link
                  </button>
                ) : null}
              </div>

              {publicAccess?.publicUrl ? (
                <div style={{ marginTop: '.9rem' }}>
                  <p style={{ marginBottom: '.45rem', fontSize: '.85rem', color: 'var(--muted)' }}>Public URL</p>
                  <div className="glass-card" style={{ padding: '.55rem', borderRadius: 12 }}>
                    <p style={{ margin: 0, fontSize: '.78rem', wordBreak: 'break-all' }}>{publicAccess.publicUrl}</p>
                  </div>
                  <div style={{ marginTop: '.65rem' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicAccess.publicUrl)}`}
                      alt="Quiz public link QR code"
                      width={180}
                      height={180}
                      style={{ borderRadius: 12, border: '1px solid var(--line)', background: '#fff' }}
                    />
                  </div>
                </div>
              ) : null}
            </article>

            <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1', display: activeBuilderTab === 'END_FORM' ? 'block' : 'none' }}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
                <section
                  className="glass-card"
                  style={{
                    padding: '.95rem',
                    borderRadius: 16,
                    border: '1px solid var(--line)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,.96), rgba(245,248,255,.88))'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.8rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>End Form Block</h3>
                      <p style={{ color: 'var(--muted)', margin: '.35rem 0 0', fontSize: '.9rem' }}>
                        Configure a polished lead-capture step after quiz completion.
                      </p>
                    </div>
                    <span
                      style={{
                        padding: '.32rem .6rem',
                        borderRadius: 999,
                        fontSize: '.74rem',
                        letterSpacing: '.03em',
                        border: '1px solid var(--line)',
                        background: endFormEnabled ? 'rgba(16, 185, 129, .12)' : 'rgba(148, 163, 184, .18)',
                        color: endFormEnabled ? '#047857' : '#475569',
                        fontWeight: 700
                      }}
                    >
                      {endFormEnabled ? 'LIVE' : 'DISABLED'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: '.65rem', marginTop: '.85rem' }}>
                    <label
                      className="field"
                      style={{
                        marginBottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        padding: '.6rem .7rem',
                        background: 'rgba(255,255,255,.7)'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Enable end form</span>
                      <input type="checkbox" checked={endFormEnabled} onChange={(event) => setEndFormEnabled(event.target.checked)} />
                    </label>

                    <label
                      className="field"
                      style={{
                        marginBottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        padding: '.6rem .7rem',
                        background: 'rgba(255,255,255,.7)'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Require submit before finish</span>
                      <input
                        type="checkbox"
                        checked={endFormRequireSubmit}
                        onChange={(event) => setEndFormRequireSubmit(event.target.checked)}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gap: '.65rem', marginTop: '.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Title</label>
                      <input value={endFormTitle} onChange={(event) => setEndFormTitle(event.target.value)} style={polishedFieldControlStyle} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Description</label>
                      <input
                        value={endFormDescription}
                        onChange={(event) => setEndFormDescription(event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Submit label</label>
                      <input
                        value={endFormSubmitLabel}
                        onChange={(event) => setEndFormSubmitLabel(event.target.value)}
                        style={polishedFieldControlStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '.8rem', marginTop: '.85rem' }}>
                    {endFormFields.map((field, idx) => (
                      <div
                        key={`${field.key}-${idx}`}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: 16,
                          padding: '.8rem',
                          background: 'linear-gradient(180deg, #ffffff, #f8fbff)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'center', marginBottom: '.65rem' }}>
                          <div style={{ display: 'grid', gap: '.12rem' }}>
                            <strong style={{ fontSize: '.95rem' }}>Field #{idx + 1}</strong>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem' }}>
                              Key: <code>{field.key || `field_${idx + 1}`}</code>
                            </small>
                          </div>
                          <span className="chip" style={{ fontSize: '.72rem', letterSpacing: '.02em' }}>
                            {field.type.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gap: '.55rem', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                          <div style={{ display: 'grid', gap: '.22rem' }}>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>TYPE</small>
                            <select
                              value={field.type}
                              onChange={(event) => applySmartFieldDefaults(idx, { type: event.target.value })}
                              style={polishedFieldControlStyle}
                            >
                              {FORM_FIELD_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: 'grid', gap: '.25rem' }}>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>FIELD KEY</small>
                            <input
                              value={field.key}
                              onChange={(event) => updateEndField(idx, { key: event.target.value })}
                              onBlur={(event) => applySmartFieldDefaults(idx, { key: normalizeFieldKey(event.target.value) })}
                              placeholder={getFieldKeySuggestion(field.type, idx)}
                              spellCheck={false}
                              style={polishedFieldKeyControlStyle}
                            />
                            <small style={{ color: 'var(--muted)', fontSize: '.7rem' }}>Use lowercase `snake_case` keys</small>
                          </div>
                          <div style={{ display: 'grid', gap: '.22rem' }}>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>LABEL</small>
                            <input
                              value={field.label}
                              onChange={(event) => updateEndField(idx, { label: event.target.value })}
                              placeholder={prettifyFieldKeyLabel(field.key || getFieldKeySuggestion(field.type, idx)) || 'Field label'}
                              style={polishedFieldControlStyle}
                            />
                          </div>
                          <div style={{ display: 'grid', gap: '.22rem' }}>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>PLACEHOLDER</small>
                            <input
                              value={field.placeholder ?? ''}
                              onChange={(event) => updateEndField(idx, { placeholder: event.target.value })}
                              placeholder={getFieldPlaceholderSuggestion(field.type, field.key, idx)}
                              style={polishedFieldControlStyle}
                            />
                          </div>
                        </div>
                        {isOptionFieldType(field.type) ? (
                          <div style={{ marginTop: '.55rem', display: 'grid', gap: '.22rem' }}>
                            <small style={{ color: 'var(--muted)', fontSize: '.75rem', fontWeight: 700 }}>OPTIONS</small>
                            <input
                              value={getFieldOptionsInputValue(field)}
                              onChange={(event) =>
                                updateEndField(idx, { optionsInput: event.target.value, options: textToFieldOptions(event.target.value) })
                              }
                              onBlur={(event) =>
                                updateEndField(idx, {
                                  optionsInput: normalizeFieldOptionsInput(event.target.value),
                                  options: textToFieldOptions(event.target.value)
                                })
                              }
                              placeholder="Options (comma separated), e.g. Kosovo, Albania, North Macedonia"
                              style={polishedFieldControlStyle}
                            />
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.65rem' }}>
                          <label
                            style={{
                              display: 'inline-flex',
                              gap: '.35rem',
                              alignItems: 'center',
                              fontSize: '.9rem',
                              border: '1px solid var(--line)',
                              borderRadius: 999,
                              padding: '.25rem .55rem',
                              background: 'rgba(248,250,252,.8)'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(event) => updateEndField(idx, { required: event.target.checked })}
                            />
                            Required
                          </label>
                          <button
                            className="btn btn-ghost"
                            type="button"
                            onClick={() => removeEndField(idx)}
                            style={{ borderRadius: 12, borderColor: '#fecaca', color: '#b91c1c', background: '#fff5f5' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '.8rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost" type="button" onClick={addEndField}>
                      Add Field
                    </button>
                    <button className="btn btn-primary" type="button" onClick={() => void saveEndForm()} disabled={busy}>
                      {busy ? 'Saving...' : 'Save End Form'}
                    </button>
                  </div>
                </section>

                <section
                  className="glass-card"
                  style={{
                    padding: '.95rem',
                    borderRadius: 16,
                    border: '1px solid var(--line)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,.96), rgba(249,251,255,.9))'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.7rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Lead Submissions</h3>
                      <p style={{ margin: '.35rem 0 0', color: 'var(--muted)', fontSize: '.88rem' }}>
                        Every submission from the end form appears here.
                      </p>
                    </div>
                    <div className="chip-row">
                      <span className="chip">Status: {endFormSettings?.enabled ? 'Enabled' : 'Disabled'}</span>
                      <span className="chip">Captured: {leadSubmissions.length}</span>
                    </div>
                  </div>

                  {leadSubmissions.length > 0 ? (
                    <div style={{ marginTop: '.8rem', overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem', background: '#fff' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)', background: 'rgba(241,245,249,.55)' }}>
                            <th style={{ padding: '.58rem .65rem' }}>Date</th>
                            <th style={{ padding: '.58rem .65rem' }}>Name</th>
                            <th style={{ padding: '.58rem .65rem' }}>Email</th>
                            <th style={{ padding: '.58rem .65rem' }}>Phone</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadSubmissions.map((lead) => (
                            <tr key={lead.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '.56rem .65rem', whiteSpace: 'nowrap' }}>{new Date(lead.createdAt).toLocaleString()}</td>
                              <td style={{ padding: '.56rem .65rem' }}>{lead.name || '-'}</td>
                              <td style={{ padding: '.56rem .65rem' }}>{lead.email || '-'}</td>
                              <td style={{ padding: '.56rem .65rem' }}>{lead.phone || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: '.8rem',
                        border: '1px dashed var(--line)',
                        borderRadius: 12,
                        padding: '.85rem',
                        color: 'var(--muted)',
                        fontSize: '.9rem',
                        background: 'rgba(255,255,255,.65)'
                      }}
                    >
                      No lead submissions yet. Publish quiz and complete it once to test capture.
                    </div>
                  )}
                </section>
              </div>
            </article>

            <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1', display: activeBuilderTab === 'INSIGHTS' ? 'block' : 'none' }}>
              <h3 style={{ marginTop: 0 }}>Submissions and Answers</h3>
              {attemptInsights ? (
                <div style={{ display: 'grid', gap: '.7rem' }}>
                  <div className="chip-row">
                    <span className="chip">Attempts: {attemptInsights.summary.totalAttempts}</span>
                    <span className="chip">Submitted: {attemptInsights.summary.submittedAttempts}</span>
                    <span className="chip">In Progress: {attemptInsights.summary.inProgressAttempts}</span>
                    <span className="chip">Average Score: {attemptInsights.summary.averageScore}%</span>
                  </div>

                  {attemptInsights.questionStats?.length > 0 ? (
                    <div style={{ display: 'grid', gap: '.45rem' }}>
                      <h4 style={{ margin: '.2rem 0 0' }}>Per Question Correctness</h4>
                      {attemptInsights.questionStats.map((stat) => (
                        <div key={stat.questionId} className="glass-card" style={{ padding: '.55rem .65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                            <strong>
                              Q{stat.position}. {stat.prompt}
                            </strong>
                            <span style={{ fontWeight: 700 }}>{stat.correctRate}% correct</span>
                          </div>
                          <div
                            style={{
                              marginTop: '.4rem',
                              height: 8,
                              borderRadius: 999,
                              background: 'rgba(148,163,184,.25)',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, stat.correctRate))}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #22c55e, #16a34a)'
                              }}
                            />
                          </div>
                          <p style={{ margin: '.35rem 0 0', fontSize: '.83rem', color: 'var(--muted)' }}>
                            Answered: {stat.answeredCount} · Correct: {stat.correctCount} · Incorrect: {stat.incorrectCount}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {attemptInsights.attempts.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>No attempts yet for this quiz.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '.6rem' }}>
                      {attemptInsights.attempts.map((attempt) => {
                        const expanded = expandedAttemptId === attempt.attemptId;
                        return (
                          <div key={attempt.attemptId} className="glass-card" style={{ padding: '.7rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
                              <div>
                                <strong>{attempt.participant.name || attempt.participant.email}</strong>
                                <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>
                                  {attempt.participant.email} · {attempt.status}
                                </div>
                                {attempt.predictorSubmission ? (
                                  <div style={{ color: 'var(--muted)', fontSize: '.84rem', marginTop: '.2rem' }}>
                                    Prediction: {attempt.predictorSubmission.leftTeamName || 'Team 1'} {attempt.predictorSubmission.leftScore ?? 0} :{' '}
                                    {attempt.predictorSubmission.rightScore ?? 0} {attempt.predictorSubmission.rightTeamName || 'Team 2'}
                                  </div>
                                ) : null}
                                {attempt.formSubmission ? (
                                  <div style={{ color: 'var(--muted)', fontSize: '.84rem', marginTop: '.2rem' }}>
                                    Form fields submitted: {Object.keys(attempt.formSubmission).length}
                                  </div>
                                ) : null}
                                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                                  Started: {new Date(attempt.startedAt).toLocaleString()}
                                  {attempt.submittedAt ? ` · Submitted: ${new Date(attempt.submittedAt).toLocaleString()}` : ''}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700 }}>
                                  {attempt.result
                                    ? `${attempt.result.earnedPoints}/${attempt.result.totalPoints} (${attempt.result.percentage}%)`
                                    : `${attempt.score ?? 0} (${attempt.percentage ?? 0}%)`}
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                                  {attempt.result ? (attempt.result.passed ? 'Passed' : 'Not Passed') : 'Not graded yet'}
                                </div>
                                <button
                                  className="btn btn-ghost"
                                  type="button"
                                  onClick={() => setExpandedAttemptId(expanded ? null : attempt.attemptId)}
                                  style={{ marginTop: '.4rem' }}
                                >
                                  {expanded ? 'Hide Answers' : 'View Answers'}
                                </button>
                              </div>
                            </div>

                            {expanded ? (
                              <div style={{ display: 'grid', gap: '.5rem', marginTop: '.7rem' }}>
                                {attempt.predictorSubmission ? (
                                  <div className="glass-card" style={{ padding: '.6rem .65rem' }}>
                                    <strong>Predictor Selection</strong>
                                    <p style={{ margin: '.3rem 0 0', fontSize: '.9rem' }}>
                                      {attempt.predictorSubmission.leftTeamName || 'Team 1'}: <strong>{attempt.predictorSubmission.leftScore ?? 0}</strong> ·{' '}
                                      {attempt.predictorSubmission.rightTeamName || 'Team 2'}: <strong>{attempt.predictorSubmission.rightScore ?? 0}</strong>
                                    </p>
                                  </div>
                                ) : null}
                                {attempt.formSubmission ? (
                                  <div className="glass-card" style={{ padding: '.6rem .65rem' }}>
                                    <strong>Form Submission</strong>
                                    <div style={{ display: 'grid', gap: '.25rem', marginTop: '.4rem', fontSize: '.88rem' }}>
                                      {Object.entries(attempt.formSubmission).map(([key, value]) => (
                                        <div key={`${attempt.attemptId}-${key}`}>
                                          <strong>{key}:</strong>{' '}
                                          {Array.isArray(value)
                                            ? value.join(', ')
                                            : typeof value === 'string'
                                              ? value
                                              : JSON.stringify(value)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                                {attempt.answers.map((answer) => (
                                  <div key={`${attempt.attemptId}-${answer.questionId}`} className="glass-card" style={{ padding: '.55rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
                                      <strong>
                                        Q{answer.position}. {answer.prompt}
                                      </strong>
                                      <span style={{ color: 'var(--muted)', fontSize: '.82rem' }}>
                                        {answer.pointsAwarded}/{answer.points} pts{' '}
                                        {answer.isCorrect === null ? '' : answer.isCorrect ? '· Correct' : '· Incorrect'}
                                      </span>
                                    </div>
                                    {answer.selectedOptionLabels.length > 0 ? (
                                      <p style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
                                        <strong>Student:</strong> {answer.selectedOptionLabels.join(', ')}
                                      </p>
                                    ) : null}
                                    {answer.shortTextAnswer ? (
                                      <p style={{ margin: '.35rem 0 0', fontSize: '.85rem' }}>
                                        <strong>Student:</strong> {answer.shortTextAnswer}
                                      </p>
                                    ) : null}
                                    {answer.correctOptionLabels.length > 0 ? (
                                      <p style={{ margin: '.25rem 0 0', fontSize: '.82rem', color: 'var(--muted)' }}>
                                        Correct: {answer.correctOptionLabels.join(', ')}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: 'var(--muted)' }}>Loading insights...</p>
              )}
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
