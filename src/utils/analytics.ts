import { dimensions, questions } from "@/data/questions";
import { assessDataQuality, type DataQualityResult } from "@/utils/dataQuality";
import { scoreItem } from "@/utils/scoring";
import type { AssessmentSession, DashboardData, Dimension } from "@/types";

export function mean(values: number[]): number {
  return values.length
    ? Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
          2,
        ),
      )
    : 0;
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return (
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    (values.length - 1)
  );
}

export function cronbachAlpha(
  records: AssessmentSession[],
  dimension: Dimension,
): number | null {
  const completed = records.filter((record) => record.status === "completed");
  const items = questions.filter(
    (question) => question.dimension === dimension,
  );
  if (completed.length < 3 || items.length < 2) return null;

  const itemValues = items.map((question) =>
    completed.map((record) =>
      scoreItem(question, record.answers[question.id]!),
    ),
  );
  const totals = completed.map((record) =>
    items.reduce(
      (sum, question) =>
        sum + scoreItem(question, record.answers[question.id]!),
      0,
    ),
  );
  const totalVariance = sampleVariance(totals);
  if (!totalVariance) return null;
  const alpha =
    (items.length / (items.length - 1)) *
    (1 -
      itemValues.reduce((sum, values) => sum + sampleVariance(values), 0) /
        totalVariance);
  return Number(alpha.toFixed(2));
}

export function correlation(left: number[], right: number[]): number | null {
  if (left.length < 3 || left.length !== right.length) return null;
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce(
    (sum, value, index) =>
      sum + (value - leftMean) * (right[index] - rightMean),
    0,
  );
  const leftDenominator = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0),
  );
  const rightDenominator = Math.sqrt(
    right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0),
  );
  return leftDenominator && rightDenominator
    ? Number((numerator / (leftDenominator * rightDenominator)).toFixed(2))
    : null;
}

export function buildDashboardStats(
  data: DashboardData,
  options: { excludeLikelyInvalid?: boolean } = {},
) {
  const sessions = data.sessions;
  const completed = sessions.filter((record) => record.status === "completed");
  const qualityBySession = Object.fromEntries(
    completed.map((record) => [
      record.id,
      assessDataQuality(record.answers, record.completionSeconds),
    ]),
  ) as Record<string, DataQualityResult>;
  const qualitySummary = completed.reduce(
    (summary, record) => {
      summary[qualityBySession[record.id].level] += 1;
      return summary;
    },
    { normal: 0, review: 0, likely_invalid: 0 },
  );
  const includedCompleted = options.excludeLikelyInvalid
    ? completed.filter(
        (record) => qualityBySession[record.id].level !== "likely_invalid",
      )
    : completed;
  const averages = dimensions.map((dimension) => {
    const values = includedCompleted
      .map((record) => record.scores[dimension])
      .filter((score) => score > 0);
    return {
      dimension,
      average: mean(values),
      alpha: cronbachAlpha(completed, dimension),
    };
  });
  const items = questions.map((question) => {
    const values = includedCompleted.flatMap((record) => {
      const answer = record.answers[question.id];
      return answer === undefined ? [] : [answer];
    });
    return {
      question,
      average: mean(values),
      distribution: [1, 2, 3, 4, 5].map(
        (score) => values.filter((value) => value === score).length,
      ),
    };
  });
  const feedbackRecords = includedCompleted.flatMap((record) =>
    record.feedback
      ? [
          {
            ...record.feedback,
            sessionId: record.id,
            completedAt: record.completedAt,
            completionSeconds: record.completionSeconds,
          },
        ]
      : [],
  );
  const feedbackAverages = {
    questionsClear: mean(
      feedbackRecords.map((feedback) => feedback.questionsClear),
    ),
    platformEasy: mean(
      feedbackRecords.map((feedback) => feedback.platformEasy),
    ),
    resultClear: mean(feedbackRecords.map((feedback) => feedback.resultClear)),
    lengthAppropriate: mean(
      feedbackRecords.map((feedback) => feedback.lengthAppropriate),
    ),
  };
  const openness = includedCompleted.map((record) => record.scores.openness);
  const benefit = includedCompleted.map((record) => record.scores.aiBenefit);

  return {
    participantCount: sessions.length,
    completedCount: includedCompleted.length,
    completionRate: sessions.length
      ? Number(((includedCompleted.length / sessions.length) * 100).toFixed(1))
      : 0,
    averageCompletionSeconds: mean(
      includedCompleted.flatMap((record) =>
        record.completionSeconds === null ? [] : [record.completionSeconds],
      ),
    ),
    averages,
    items,
    feedbackAverages,
    feedbackRecords,
    qualitySummary,
    qualityBySession,
    correlation: correlation(openness, benefit),
    correlationN: includedCompleted.length,
    recent: [...sessions]
      .filter(
        (record) =>
          !options.excludeLikelyInvalid ||
          record.status !== "completed" ||
          qualityBySession[record.id].level !== "likely_invalid",
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .slice(0, 10)
      .map((record) => ({
        ...record,
        quality:
          record.status === "completed" ? qualityBySession[record.id] : null,
      })),
  };
}
