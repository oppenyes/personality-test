import { describe, expect, it } from 'vitest'
import { dimensions, questions } from '@/data/questions'
import { calculateDimensionScores, isComplete, reverseScore, scoreItem, scoreRangeIsValid, validateItemBank } from '@/utils/scoring'
import type { AnswerMap, LikertScore } from '@/types'

const fullAnswers = Object.fromEntries(questions.map((question) => [question.id, 5])) as AnswerMap

describe('scoring', () => {
  it('scores forward and reverse items using 6 - rawScore', () => {
    const forward = questions.find((question) => !question.reverse)!
    const reverse = questions.find((question) => question.reverse)!
    expect(scoreItem(forward, 5)).toBe(5)
    expect(scoreItem(reverse, 5)).toBe(1)
    expect(reverseScore(1)).toBe(5)
    expect(reverseScore(3)).toBe(3)
  })

  it('calculates a dimension as the mean of its valid scored items', () => {
    const answers: AnswerMap = { bfi_o1: 5, bfi_o2: 3, bfi_o3: 5, bfi_o4: 1 }
    expect(calculateDimensionScores(answers).openness).toBe(3.5)
  })

  it('matches the manual expected score for a fixed full response set', () => {
    const scores = calculateDimensionScores(fullAnswers)
    expect(scores.openness).toBe(3)
    expect(scores.conscientiousness).toBe(3)
    expect(scores.extraversion).toBe(3)
    expect(scores.agreeableness).toBe(3)
    expect(scores.neuroticism).toBe(3)
    expect(scores.aiBenefit).toBe(3.67)
    expect(scores.aiConcern).toBe(5)
    expect(scores.aiAgency).toBe(3.67)
  })

  it('does not allow submission while required items are missing', () => {
    expect(isComplete({ bfi_o1: 5 })).toBe(false)
    expect(isComplete(fullAnswers)).toBe(true)
  })

  it('has unique question IDs/orders and complete dimension mappings', () => {
    expect(validateItemBank()).toEqual([])
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    expect(new Set(questions.map((question) => question.order)).size).toBe(questions.length)
  })

  it('applies reverse scoring to every reverse-coded item and keeps completed scores in range', () => {
    const reverseItems = questions.filter((question) => question.reverse)
    expect(reverseItems.every((question) => scoreItem(question, 5 as LikertScore) === 1)).toBe(true)
    const scores = calculateDimensionScores(fullAnswers)
    expect(scoreRangeIsValid(scores)).toBe(true)
    expect(dimensions.every((dimension) => scores[dimension] >= 1 && scores[dimension] <= 5)).toBe(true)
  })
})
