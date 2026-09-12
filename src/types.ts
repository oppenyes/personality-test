export type Section = 'personality' | 'attitude'
export type BigFiveTrait = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism'
export type AttitudeTrait = 'aiBenefit' | 'aiConcern' | 'aiAgency'
export type Dimension = BigFiveTrait | AttitudeTrait
export type LikertScore = 1 | 2 | 3 | 4 | 5
export type AnswerMap = Partial<Record<string, LikertScore>>

export interface Question {
  id: string
  text: string
  section: Section
  construct: string
  dimension: Dimension
  reverse: boolean
  order: number
  source: string
}

export interface DimensionMeta {
  name: string
  shortName: string
  description: string
  low: string
  high: string
}

export interface AssessmentSession {
  id: string
  startedAt: string
  completedAt: string | null
  completionSeconds: number | null
  status: 'in_progress' | 'completed'
  answers: AnswerMap
  scores: Record<Dimension, number>
  feedback: PilotFeedback | null
  dataSource: 'supabase' | 'local'
}

export interface PilotFeedback {
  questionsClear: LikertScore
  platformEasy: LikertScore
  resultClear: LikertScore
  lengthAppropriate: LikertScore
  confusingPart: string
  improvement: string
  submittedAt?: string
}

export interface DashboardData {
  sessions: AssessmentSession[]
  source: 'supabase' | 'local'
}
