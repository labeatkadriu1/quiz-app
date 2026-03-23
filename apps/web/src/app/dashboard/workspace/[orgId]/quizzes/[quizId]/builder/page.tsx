'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT';
type QuizFlowMode = 'STEP_BY_STEP' | 'ALL_AT_ONCE';
type PublicAccessMode = 'PUBLIC_LINK' | 'APPROVAL' | 'PASSWORD';
type AssignmentScope =
  | 'STUDENT'
  | 'SELECTED_STUDENTS'
  | 'CLASS'
  | 'MULTI_CLASS'
  | 'TEACHER_STUDENTS'
  | 'SCHOOL_WIDE'
  | 'PUBLIC_LINK'
  | 'EMBED_PUBLIC';

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
  targets: AssignmentTargetItem[];
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
  const [quizFlowMode, setQuizFlowMode] = useState<QuizFlowMode>('STEP_BY_STEP');
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(true);
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

  useEffect(() => {
    void loadAll();
  }, [orgId, quizId]);

  const nextPosition = useMemo(() => (quiz?.questions?.length ?? 0) + 1, [quiz]);
  const isChoiceType = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
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
    await Promise.all([loadPublicAccess(), loadAssignmentData(), loadLatestAssignment(), loadEndForm(), loadQuizSettings()]);
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
        'EMBED_PUBLIC'
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
    } catch {
      // Leave defaults when latest assignment cannot be loaded.
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

  function removeEndField(index: number): void {
    setEndFormFields((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addEndField(): void {
    const nextIndex = endFormFields.length + 1;
    setEndFormFields((prev) => [
      ...prev,
      {
        type: 'text',
        key: `field_${nextIndex}`,
        label: `Field ${nextIndex}`,
        placeholder: '',
        required: false
      }
    ]);
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
          fields: endFormFields
            .map((field) => ({
              type: field.type.trim(),
              key: field.key.trim(),
              label: field.label.trim(),
              placeholder: field.placeholder?.trim() || '',
              required: Boolean(field.required)
            }))
            .filter((field) => field.type && field.key && field.label)
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

      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(payload.message ?? 'Unable to create assignment');
        return;
      }

      setSuccess('Assignment created successfully.');
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
            <span className="chip">Questions: {quiz.questions?.length ?? 0}</span>
            <span className="chip">Pass Score: {quiz.passScore}%</span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
            <Link href={`/dashboard/workspace/${orgId}/quizzes`} className="btn btn-ghost">
              Back to Quizzes
            </Link>
            {quiz.status === 'DRAFT' ? (
              <button className="btn btn-primary" type="button" onClick={() => void publishQuiz()} disabled={busy}>
                Publish Quiz
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="container">
        <div className="feature-grid">
          <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1' }}>
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

          <article className="glass-card" style={{ padding: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>{editingQuestionId ? 'Edit Question' : 'Add Question'}</h3>
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
          </article>

          <article className="glass-card" style={{ padding: '1rem', gridColumn: 'span 2' }}>
            <h3 style={{ marginTop: 0 }}>Question Outline</h3>
            {quiz.questions && quiz.questions.length > 0 ? (
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
            <article className="glass-card" style={{ padding: '1rem', gridColumn: 'span 2' }}>
              <h3 style={{ marginTop: 0 }}>Assignment Flow</h3>
              <p style={{ marginTop: 0, color: 'var(--muted)' }}>
                Assign immediately after publish to class, selected students, school-wide, or public/embed scopes.
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
            </article>

            <article className="glass-card" style={{ padding: '1rem' }}>
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

            <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1' }}>
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
                      <input value={endFormTitle} onChange={(event) => setEndFormTitle(event.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Description</label>
                      <input value={endFormDescription} onChange={(event) => setEndFormDescription(event.target.value)} />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Submit label</label>
                      <input value={endFormSubmitLabel} onChange={(event) => setEndFormSubmitLabel(event.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '.55rem', marginTop: '.85rem' }}>
                    {endFormFields.map((field, idx) => (
                      <div
                        key={`${field.key}-${idx}`}
                        style={{
                          border: '1px solid var(--line)',
                          borderRadius: 14,
                          padding: '.6rem',
                          background: 'rgba(255,255,255,.88)'
                        }}
                      >
                        <div style={{ display: 'grid', gap: '.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                          <select
                            value={field.type}
                            onChange={(event) => updateEndField(idx, { type: event.target.value })}
                            style={{
                              border: '1px solid var(--line)',
                              borderRadius: 10,
                              padding: '0.55rem 0.65rem',
                              fontSize: '.92rem',
                              background: '#fff'
                            }}
                          >
                            <option value="text">Text</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                            <option value="textarea">Textarea</option>
                          </select>
                          <input
                            value={field.key}
                            onChange={(event) => updateEndField(idx, { key: event.target.value })}
                            placeholder="Field key"
                          />
                          <input
                            value={field.label}
                            onChange={(event) => updateEndField(idx, { label: event.target.value })}
                            placeholder="Field label"
                          />
                          <input
                            value={field.placeholder ?? ''}
                            onChange={(event) => updateEndField(idx, { placeholder: event.target.value })}
                            placeholder="Placeholder text"
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem' }}>
                          <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', fontSize: '.9rem' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(event) => updateEndField(idx, { required: event.target.checked })}
                            />
                            Required
                          </label>
                          <button className="btn btn-ghost" type="button" onClick={() => removeEndField(idx)}>
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

            <article className="glass-card" style={{ padding: '1rem', gridColumn: '1 / -1' }}>
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
