# Pilot Evaluation

## Purpose

本项目的 pilot 旨在检查匿名测评流程、数据保存、结果展示、反馈和研究者后台是否可用。它不是 formal validation，也不用于证明人格量表或 AI 态度题项的心理测量性质。

## Data availability

本次最终交付整理时，工程中未找到 `docs/pilot/final_pilot_data.csv`。因此下面所有需要 CSV 才能计算的数值均为“无法确认”，不会从旧 README、口头描述或仪表板界面推断。

这意味着目前无法报告：总 sessions、completed/incomplete sessions、completion rate、完成时长均值/中位数/最小值/最大值、feedback 数、质量等级数量、维度描述统计、题目分布、反馈主题或 usability findings。

## Completion Statistics

- Total sessions: 无法确认（最终 CSV 缺失）。
- Completed sessions: 无法确认。
- Incomplete sessions: 无法确认。
- Completion rate: 无法确认。
- Completed-session completion time: mean、median、min、max 均无法确认。

## Data Quality Screening

代码对完成的 29 题回答执行 rule-based response quality screening：

- 完成时间少于 60 秒；
- 最长连续相同原始回答达到 15 题；
- 单一选项占 29 题的至少 85%；
- 原始回答标准差小于 0.5；
- 在 `questions.ts` 明确配置的配对中，至少 2 对正反向题同时高同意或同时高不同意。

每条规则触发 1 个风险点：0–1 为 `normal`，2 为 `review`，3 或以上为 `likely_invalid`。这些是 heuristic flags；`likely_invalid` 仅表示 according to the predefined heuristic rules 的标记，不能证明参与者故意乱填、撒谎或其回答必然无效。没有 CSV 时，各等级数量无法确认。

后台默认保留全部完成数据；`Exclude likely invalid` 只从聚合统计中排除 `likely_invalid`，不自动排除 `review`。若最终 CSV 被加入，可比较包含全部 completed responses 与排除 `likely_invalid` 后的描述统计，但小样本不应作夸张推断。

## Assessment Results

当前无法从最终 CSV 计算开放性、尽责性、外向性、宜人性、情绪敏感性、AI 学习收益感、AI 风险关注或 AI 主动使用能力的均值和标准差。任何此处出现的具体均值都必须由最终 CSV 重算后再填入。

## Feedback Results and Usability Findings

反馈表结构包括四个 1–5 评分（题目清晰、平台易用、结果清晰、长度合适）和两个可选文本字段（困惑之处、改进建议）。最终 CSV 缺失，因此不能确认反复出现的问题、参与者喜欢/不喜欢的内容、是否有人不清楚为什么有 AI 题，或是否存在明显 usability issue。

## Unusual Response Patterns

没有最终 CSV，无法识别或展示任何匿名记录的 unusual response pattern。未来分析如需引用个案，应只使用截短匿名编号，并使用 “flagged for review” 或 “likely invalid according to the predefined heuristic rules”，而非将参与者称为无效作答者。

## Changes Already Made

工程已实现匿名认证、session 所有权 RLS、researcher whitelist、评分单元测试、结果图、反馈、研究者汇总、导出以及非破坏性质量筛查。这些是代码实现事实；它们不等同于已有真实 pilot 结果。

## Limitations

- 最终 pilot CSV 未包含在当前工程，当前不能复现任何 pilot 数字。
- 即使有小样本数据，也会是 convenience sample，不能代表总体。
- 没有 formal psychometric validation。
- Big Five 是 simplified implementation；AI 态度题是 exploratory measure。
- 质量规则是 heuristic screening。
- Vercel 在中国大陆部分网络环境可能存在可访问性限制。

## Next Steps

将真实的 `docs/pilot/final_pilot_data.csv` 纳入交付包后，重新运行全部描述统计并完成数据质量、反馈和可用性分析；随后以谨慎措辞更新本文件。不要在缺少该文件时填充估计数。
