import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { questions } from '@/data/questions'
import { calculateDimensionScores, scoreItem } from '@/utils/scoring'
import type { AssessmentSession, DashboardData, PilotFeedback } from '@/types'

const storageKey = 'agentic-ai-assessment-sessions-v2'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = Boolean(supabase)

async function ensureAnonymousParticipant(): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data: currentSession } = await supabase.auth.getSession()
  if (currentSession.session?.user.is_anonymous) {
    return currentSession.session.user.id
  }

  // A researcher session must not be reused as a participant identity.
  if (currentSession.session) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Unable to establish an anonymous participant session.')
  }

  return data.user.id
}

function localSessions(): AssessmentSession[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '[]') as AssessmentSession[]
  } catch {
    return []
  }
}

function saveLocalSessions(sessions: AssessmentSession[]) {
  localStorage.setItem(storageKey, JSON.stringify(sessions))
}

export async function startSession(): Promise<AssessmentSession> {
  const session: AssessmentSession = {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    completionSeconds: null,
    status: 'in_progress',
    answers: {},
    scores: calculateDimensionScores({}),
    feedback: null,
    dataSource: supabase ? 'supabase' : 'local',
  }

  if (supabase) {
    const participantUid = await ensureAnonymousParticipant()
    const { error } = await supabase
      .from('assessment_sessions')
      .insert({ id: session.id, participant_uid: participantUid, started_at: session.startedAt, status: session.status })
    if (error) throw new Error(error.message)
    return session
  }

  session.dataSource = 'local'
  saveLocalSessions([...localSessions(), session])
  return session
}

export async function completeSession(session: AssessmentSession): Promise<AssessmentSession> {
  const completed: AssessmentSession = { ...session, dataSource: session.dataSource, status: 'completed' }
  if (session.dataSource === 'supabase' && supabase) {
    const responseRows = questions.map((question) => ({
      session_id: completed.id,
      question_id: question.id,
      raw_score: completed.answers[question.id],
      scored_score: scoreItem(question, completed.answers[question.id]!),
    }))
    const scoreRows = Object.entries(completed.scores).map(([dimension, score]) => ({ session_id: completed.id, dimension, score }))
    const { error } = await supabase.from('assessment_sessions').update({ status: 'completed', completed_at: completed.completedAt, completion_seconds: completed.completionSeconds }).eq('id', completed.id)
    if (!error) {
      const [{ error: responseError }, { error: scoreError }] = await Promise.all([
        supabase.from('responses').insert(responseRows),
        supabase.from('dimension_scores').insert(scoreRows),
      ])
      if (!responseError && !scoreError) return completed
      throw new Error(responseError?.message ?? scoreError?.message)
    } else {
      throw new Error(error.message)
    }
  }

  completed.dataSource = 'local'
  const sessions = localSessions()
  const index = sessions.findIndex((record) => record.id === completed.id)
  saveLocalSessions(index >= 0 ? sessions.map((record) => record.id === completed.id ? completed : record) : [...sessions, completed])
  return completed
}

export async function submitFeedback(sessionId: string, feedback: PilotFeedback, source: AssessmentSession['dataSource']): Promise<void> {
  const withTimestamp = { ...feedback, submittedAt: new Date().toISOString() }
  if (source === 'supabase' && supabase) {
    const { error } = await supabase.from('feedback').upsert({
      session_id: sessionId,
      questions_clear: feedback.questionsClear,
      platform_easy: feedback.platformEasy,
      result_clear: feedback.resultClear,
      length_appropriate: feedback.lengthAppropriate,
      confusing_part: feedback.confusingPart || null,
      improvement: feedback.improvement || null,
    })
    if (!error) return
    throw new Error(error.message)
  }
  saveLocalSessions(localSessions().map((record) => record.id === sessionId ? { ...record, feedback: withTimestamp } : record))
}

export async function fetchDashboardData(): Promise<DashboardData> {
  if (!supabase) return { sessions: localSessions(), source: 'local' }
  const [{ data: sessionRows, error: sessionError }, { data: responseRows, error: responseError }, { error: scoreError }, { data: feedbackRows, error: feedbackError }] = await Promise.all([
    supabase.from('assessment_sessions').select('*').order('started_at', { ascending: false }),
    supabase.from('responses').select('*'),
    supabase.from('dimension_scores').select('*'),
    supabase.from('feedback').select('*'),
  ])
  if (sessionError || responseError || scoreError || feedbackError) throw new Error('无法读取 Supabase 研究数据。请确认已使用 Supabase Auth 登录并执行 schema.sql。')

  const sessions = (sessionRows ?? []).map((row) => {
    const answers = Object.fromEntries((responseRows ?? []).filter((item) => item.session_id === row.id).map((item) => [item.question_id, item.raw_score]))
    const feedback = (feedbackRows ?? []).find((item) => item.session_id === row.id)
    return {
      id: row.id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      completionSeconds: row.completion_seconds,
      status: row.status,
      answers,
      scores: calculateDimensionScores(answers),
      feedback: feedback ? {
        questionsClear: feedback.questions_clear,
        platformEasy: feedback.platform_easy,
        resultClear: feedback.result_clear,
        lengthAppropriate: feedback.length_appropriate,
        confusingPart: feedback.confusing_part ?? '',
        improvement: feedback.improvement ?? '',
        submittedAt: feedback.created_at,
      } : null,
      dataSource: 'supabase' as const,
    } satisfies AssessmentSession
  })
  return { sessions, source: 'supabase' }
}

export async function adminSignIn(email: string, password: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!(await hasSupabaseAdminSession())) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new Error('该账号未在 researchers 表中获授权，无法访问研究者数据。')
  }
}

export async function hasSupabaseAdminSession(): Promise<boolean> {
  if (!supabase) return false
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session || sessionData.session.user.is_anonymous) return false
  const { data, error } = await supabase.rpc('is_researcher')
  return !error && data === true
}
