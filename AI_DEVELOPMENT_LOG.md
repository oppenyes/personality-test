# AI Development Record

## Role of Agentic AI

本项目代码高度依赖 Codex / Agentic AI。Codex 参与了架构建议、Vue 前端实现、Supabase 接入、评分与统计工具、Vitest 测试、ECharts 图表、研究者仪表板、数据质量筛查和文档整理。

项目作者的工作不是把 AI 输出不经检查地提交，而是定义目标、逐步细化需求、选择和确认方案、配置 Supabase、执行 SQL、启用 Anonymous Auth、创建 researcher 白名单、配置 Git/GitHub/Vercel、手工测试、审查输出，并在发现问题后要求 AI 修正。

开发模式可以概括为：问题定义 -> 提示 AI -> 检查实现 -> 测试 -> 发现问题 -> 细化需求 -> 再测试。

## Important Interaction 1: Initial architecture and scoring

初始需求是将本地 Vue 测评原型整理为可进行匿名 pilot 的 Web assessment。Codex 将原先散落在 UI 中的题目、计分、统计和本地存储职责拆分为数据题库、评分纯函数、统计工具和 repository。作者要求增加可重复验证的评分测试，而不是只在页面上查看分数。

结果是 `src/data/questions.ts` 提供 29 道数据驱动题目，`src/utils/scoring.ts` 负责反向计分和维度均分，`src/utils/scoring.test.ts` 覆盖固定答案与题库完整性。人工可核对的全 5 答案案例与代码一致：五个 Big Five 维度均为 3.00，AI 学习收益感与主动使用能力均为 3.67，AI 风险关注为 5.00。

## Important Interaction 2: Supabase security review

开发过程中，作者发现早期 AI 方案的 RLS 思路过宽。现有开发记录明确记载过 `using(true)` / `with check(true)` 以及将整个 `authenticated` 角色等同于研究者的风险。前者不能验证 session 所有权；后者在启用 Supabase Anonymous Auth 后尤其危险，因为匿名参与者也会持有 authenticated JWT。

修正后的 `supabase/schema.sql` 使用 `assessment_sessions.participant_uid = auth.uid()` 约束参与者自己的 session。responses、dimension_scores 和 feedback 的策略均通过父 session 再次检查同一所有权。研究者读取权限不再依赖 `to authenticated using(true)`，而是经 `researchers.user_id` 和 security-definer 函数 `is_researcher()` 判断。作者还要求 README 记录分浏览器/无痕窗口进行权限验证的步骤。

这个案例说明：AI 生成的代码即使看起来可运行，也可能存在逻辑或安全问题；人工审查和实际权限测试仍不可替代。

## Important Interaction 3: Anonymous participant flow

作者配置 Supabase URL、anon key 和 Anonymous Auth 后，首次创建匿名会话曾显示 “Anonymous sign-ins are disabled”。原因是 Supabase 控制台中的 Anonymous Auth 未正确开启，而不是前端需要 service_role key。开启该 provider 后，repository 通过 `supabase.auth.signInAnonymously()` 建立参与者身份，并把该用户的 UID 写入 session。

## Important Interaction 4: Researcher dashboard and data quality screening

Codex 协助实现 ECharts 结果图、研究者汇总、feedback、CSV/JSON 导出和 rule-based response quality screening。作者明确限定：质量规则只能标记和展示，不能自动删除数据，也不能改变既有评分。最终实现对完成时间、连续相同回答、单选项集中度、原始回答标准差和明确配置的反向题配对进行启发式筛查。

## Verification record

代码层面已包含 6 个 scoring tests 与 6 个 data-quality tests。最终交付整理时会重新执行 `npm test`、`npm run typecheck`、`npm run lint` 与 `npm run build`，结果记录在 [SCORING_VERIFICATION.md](./SCORING_VERIFICATION.md)。本文件不把缺失的最终 pilot CSV、未见证的用户反馈或未执行的生产权限测试写成既成事实。

## Lessons learned

- Agentic AI 可以快速产生大量实现，但不能替代需求判断、安全审查和验证。
- 评分规则应从 UI 中分离，并用固定答案进行自动与手动交叉核对。
- Supabase 的 authenticated 角色不是 researcher 角色；Anonymous Auth 使这个区别成为真实的安全边界。
- 小样本 pilot、探索性相关和 Cronbach's alpha 都不能被包装成正式心理测量验证。
