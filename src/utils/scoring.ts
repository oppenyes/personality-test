import { dimensionMeta, dimensions, questions } from '@/data/questions'
import type { AnswerMap, Dimension, LikertScore, Question } from '@/types'

export function reverseScore(rawScore: LikertScore): LikertScore {
  return (6 - rawScore) as LikertScore
}

export function scoreItem(question: Question, rawScore: LikertScore): LikertScore {
  return question.reverse ? reverseScore(rawScore) : rawScore
}

export function isComplete(answers: AnswerMap, itemBank: Question[] = questions): boolean {
  return itemBank.every((question) => answers[question.id] !== undefined)
}

export function calculateDimensionScores(
  answers: AnswerMap,
  itemBank: Question[] = questions,
): Record<Dimension, number> {
  const scoredItems = new Map<Dimension, number[]>()

  itemBank.forEach((question) => {
    const rawScore = answers[question.id]
    if (rawScore === undefined) return
    const values = scoredItems.get(question.dimension) ?? []
    values.push(scoreItem(question, rawScore))
    scoredItems.set(question.dimension, values)
  })

  return dimensions.reduce((scores, dimension) => {
    const values = scoredItems.get(dimension) ?? []
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    scores[dimension] = Number(average.toFixed(2))
    return scores
  }, {} as Record<Dimension, number>)
}

export function scoreRangeIsValid(scores: Record<Dimension, number>, requireAnswered = true): boolean {
  return dimensions.every((dimension) => {
    const score = scores[dimension]
    return requireAnswered ? score >= 1 && score <= 5 : score >= 0 && score <= 5
  })
}

export function validateItemBank(itemBank: Question[] = questions): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const orders = new Set<number>()
  const dimensionCounts = new Map<Dimension, number>()

  itemBank.forEach((question) => {
    if (ids.has(question.id)) errors.push(`Duplicate question id: ${question.id}`)
    if (orders.has(question.order)) errors.push(`Duplicate question order: ${question.order}`)
    if (!(question.dimension in dimensionMeta)) errors.push(`Unknown dimension: ${question.dimension}`)
    ids.add(question.id)
    orders.add(question.order)
    dimensionCounts.set(question.dimension, (dimensionCounts.get(question.dimension) ?? 0) + 1)
  })

  dimensions.forEach((dimension) => {
    if (!dimensionCounts.get(dimension)) errors.push(`Missing dimension mapping: ${dimension}`)
  })

  return errors
}
