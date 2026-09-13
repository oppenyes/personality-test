# Scoring Verification

## Questionnaire structure

题库定义在 `src/data/questions.ts`，共 29 题：20 道 simplified Big Five-based personality items（每个维度 4 题）和 9 道 exploratory AI attitude items（每个维度 3 题）。所有题均为必答 1–5 Likert：1“非常不同意”至 5“非常同意”。

Big Five 维度为 openness、conscientiousness、extraversion、agreeableness、neuroticism；AI 维度为 aiBenefit、aiConcern、aiAgency。

## Formula and implementation

实现位于 `src/utils/scoring.ts`：

- 正向题：`scored = raw`。
- 反向题：`scored = 6 - raw`。
- 每个维度：该维度所有已回答的计分题的算术平均值。
- 结果：使用 `toFixed(2)` 保留两位小数，完整回答的维度范围为 1–5。

正反向题由 `questions.ts` 的 `reverse` 标记控制。Big Five 共 10 道反向题；AI 共 2 道反向题。

## Manual expected-value case

对 29 道题全部回答 raw response = 5：

| Dimension | Expected score |
| --- | ---: |
| Openness | 3.00 |
| Conscientiousness | 3.00 |
| Extraversion | 3.00 |
| Agreeableness | 3.00 |
| Neuroticism | 3.00 |
| AI benefit | 3.67 |
| AI concern | 5.00 |
| AI agency | 3.67 |

五个 Big Five 维度各有两道正向题和两道反向题；全选 5 时，正向题计为 5、反向题计为 1，平均为 3.00。AI benefit 和 AI agency 各有两道正向题、一道反向题，因此为 `(5 + 5 + 1) / 3 = 3.67`；AI concern 三题都是正向题，因此为 5.00。

## Automated checks

`src/utils/scoring.test.ts` 有 6 个测试，覆盖正反向变换、维度均分、上述全 5 案例、必答校验、题目 ID/顺序/维度映射和所有反向题的处理/分值范围。

`src/utils/dataQuality.test.ts` 有 6 个测试，覆盖完成时间、连续相同回答、单一选项集中度、标准差、显式反向配对矛盾及质量等级。它们验证的是 quality screening，不会改变评分函数。

## Final command verification

最终交付整理期间实际执行：

```text
npm test
npm run typecheck
npm run lint
npm run build
```

结果：

- `npm test`: 2 个测试文件通过，12/12 tests passed（scoring 6，data quality 6）。
- `npm run typecheck`: 通过。
- `npm run lint`: 通过，且 `--max-warnings=0`。
- `npm run build`: 通过。Vite 提示压缩后一个 JavaScript chunk 超过 500 kB；这是性能优化提示，不是构建错误。本次最终整理未为此重构或改变功能。
