import { describe, expect, it } from "vitest";
import { questions } from "@/data/questions";
import {
  assessDataQuality,
  dominantOptionMetrics,
  longestSameAnswerRun,
  responseStandardDeviation,
  reverseInconsistentPairs,
} from "@/utils/dataQuality";
import type { AnswerMap, LikertScore } from "@/types";

const answersFrom = (values: LikertScore[]): AnswerMap =>
  Object.fromEntries(
    questions.map((question, index) => [question.id, values[index]]),
  );
const variedAnswers = answersFrom(
  questions.map((_, index) => ((index % 5) + 1) as LikertScore),
);
const inconsistentPairAnswers: AnswerMap = {
  ...variedAnswers,
  bfi_c1: 5,
  bfi_c3: 5,
  ai_g1: 1,
  ai_g2: 1,
};

describe("data quality checks", () => {
  it("marks completion under 60 seconds", () => {
    const result = assessDataQuality(variedAnswers, 59);
    expect(result.score).toBe(1);
    expect(result.reasons[0]).toContain("59 秒");
  });
  it("calculates the longest run and flags 15 or more identical answers", () => {
    const values = questions.map((_, index) =>
      index < 15 ? 3 : (((index % 5) + 1) as LikertScore),
    );
    expect(longestSameAnswerRun(answersFrom(values))).toBe(15);
    expect(
      assessDataQuality(answersFrom(values), 120).reasons.some((reason) =>
        reason.includes("15 题"),
      ),
    ).toBe(true);
  });
  it("flags one option occupying at least 85 percent of all items", () => {
    const values = questions.map(
      (_, index) => (index < 25 ? 4 : 2) as LikertScore,
    );
    const dominant = dominantOptionMetrics(answersFrom(values));
    expect(dominant.option).toBe(4);
    expect(dominant.ratio).toBeCloseTo(25 / 29);
    expect(
      assessDataQuality(answersFrom(values), 120).reasons.some((reason) =>
        reason.includes("86%"),
      ),
    ).toBe(true);
  });
  it("flags a raw-response standard deviation below 0.5", () => {
    const flatAnswers = answersFrom(questions.map(() => 3 as LikertScore));
    expect(responseStandardDeviation(flatAnswers)).toBe(0);
    expect(
      assessDataQuality(flatAnswers, 120).reasons.some((reason) =>
        reason.includes("标准差"),
      ),
    ).toBe(true);
  });
  it("uses only explicitly configured reverse pairs and flags two severe inconsistencies", () => {
    const answers = { ...inconsistentPairAnswers };
    expect(
      reverseInconsistentPairs(answers).map((pair) => pair.first.id),
    ).toEqual(["bfi_c1", "ai_g1"]);
    expect(
      assessDataQuality(answers, 120).reasons.some((reason) =>
        reason.includes("2 对"),
      ),
    ).toBe(true);
  });
  it("derives normal, review, and likely_invalid without deleting records", () => {
    expect(assessDataQuality(variedAnswers, 120).level).toBe("normal");
    expect(assessDataQuality(variedAnswers, 59).level).toBe("normal");
    const review = assessDataQuality(inconsistentPairAnswers, 59);
    expect(review.level).toBe("review");
    expect(
      assessDataQuality(answersFrom(questions.map(() => 3 as LikertScore)), 30)
        .level,
    ).toBe("likely_invalid");
  });
});
