import { questions } from "@/data/questions";
import type { AnswerMap, LikertScore, Question } from "@/types";

export type QualityLevel = "normal" | "review" | "likely_invalid";

export interface DataQualityResult {
  level: QualityLevel;
  score: number;
  reasons: string[];
  metrics: {
    completionSeconds: number | null;
    longestSameAnswerRun: number;
    dominantOption: LikertScore | null;
    dominantOptionRatio: number;
    responseStandardDeviation: number;
    reverseInconsistentPairCount: number;
  };
}

function orderedRawAnswers(answers: AnswerMap, itemBank: Question[]) {
  return [...itemBank]
    .sort((left, right) => left.order - right.order)
    .flatMap((question) => {
      const answer = answers[question.id];
      return answer === undefined ? [] : [answer];
    });
}

export function longestSameAnswerRun(
  answers: AnswerMap,
  itemBank: Question[] = questions,
): number {
  const values = orderedRawAnswers(answers, itemBank);
  let longest = 0;
  let current = 0;
  let previous: LikertScore | undefined;

  values.forEach((value) => {
    current = value === previous ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  });
  return longest;
}

export function dominantOptionMetrics(
  answers: AnswerMap,
  itemBank: Question[] = questions,
) {
  const values = orderedRawAnswers(answers, itemBank);
  const counts = new Map<LikertScore, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const [option, count] = [...counts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0] ?? [null, 0];
  return {
    option,
    count,
    ratio: itemBank.length ? count / itemBank.length : 0,
  };
}

export function responseStandardDeviation(
  answers: AnswerMap,
  itemBank: Question[] = questions,
): number {
  const values = orderedRawAnswers(answers, itemBank);
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

export function reverseInconsistentPairs(
  answers: AnswerMap,
  itemBank: Question[] = questions,
) {
  return itemBank.flatMap((question) => {
    if (!question.pairedQuestionId) return [];
    const pairedQuestion = itemBank.find(
      (item) => item.id === question.pairedQuestionId,
    );
    const first = answers[question.id];
    const second = answers[question.pairedQuestionId];
    if (!pairedQuestion || first === undefined || second === undefined)
      return [];
    const bothHigh = first >= 4 && second >= 4;
    const bothLow = first <= 2 && second <= 2;
    return bothHigh || bothLow
      ? [{ first: question, second: pairedQuestion }]
      : [];
  });
}

export function assessDataQuality(
  answers: AnswerMap,
  completionSeconds: number | null,
  itemBank: Question[] = questions,
): DataQualityResult {
  const reasons: string[] = [];
  const longestRun = longestSameAnswerRun(answers, itemBank);
  const dominant = dominantOptionMetrics(answers, itemBank);
  const standardDeviation = responseStandardDeviation(answers, itemBank);
  const inconsistentPairs = reverseInconsistentPairs(answers, itemBank);

  if (completionSeconds !== null && completionSeconds < 60)
    reasons.push("完成时间 " + completionSeconds + " 秒，小于 60 秒");
  if (longestRun >= 15)
    reasons.push("最长连续相同答案为 " + longestRun + " 题");
  if (dominant.ratio >= 0.85)
    reasons.push(
      "选项 " +
        dominant.option +
        " 占全部题目的 " +
        Math.round(dominant.ratio * 100) +
        "%",
    );
  if (standardDeviation < 0.5)
    reasons.push("原始回答标准差为 " + standardDeviation);
  if (inconsistentPairs.length >= 2)
    reasons.push("严重反向题矛盾共 " + inconsistentPairs.length + " 对");

  const score = reasons.length;
  return {
    level: score >= 3 ? "likely_invalid" : score === 2 ? "review" : "normal",
    score,
    reasons,
    metrics: {
      completionSeconds,
      longestSameAnswerRun: longestRun,
      dominantOption: dominant.option,
      dominantOptionRatio: Number(dominant.ratio.toFixed(2)),
      responseStandardDeviation: standardDeviation,
      reverseInconsistentPairCount: inconsistentPairs.length,
    },
  };
}
