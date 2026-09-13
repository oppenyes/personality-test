# Technical Report

## 1. What did I build?

这是一个用于 Agentic AI Web Assessment Challenge 的匿名网页测评原型。参与者阅读知情同意后，通过 Supabase Anonymous Auth 获得匿名身份，创建 session、完成 29 道题、查看维度结果，并可提交匿名 pilot feedback。研究者使用 Supabase Auth 登录；只有 `researchers` 白名单中的用户可进入 `/#/admin`，查看聚合统计、图表、质量标记和 CSV/JSON 导出。

## 2. What psychological/personality constructs did I measure?

人格部分是 a simplified Big Five-based personality assessment，包含开放性、尽责性、外向性、宜人性和情绪敏感性（代码维度名为 `neuroticism`）。它由 20 道中文教育性改写题组成，不是本项目正式验证的量表。

AI 部分是 9 道 exploratory attitude measure，包含 AI 学习收益感、AI 风险关注和 AI 主动使用能力。它关注学习或研究中对 AI 的帮助、风险/偏见/依赖担忧，以及核查、改写和给出清晰任务要求的倾向；它不是经过验证的心理量表。

## 3. Why did I select these constructs?

Big Five 是成熟且较容易解释的人格框架。AI 态度与当下学习、研究和技术使用情境相关。将两者放入同一个 pilot 网页测评，能够检验匿名答题、计分、结果展示、反馈和研究者数据流程是否能工作；这不构成关于二者关系的学术结论。

## 4. How does the scoring system work?

所有题目使用 1–5 Likert 评分：1 为“非常不同意”，5 为“非常同意”。正向题直接计分；`reverse: true` 的反向题使用 `6 - raw score`。每个维度取该维度有效计分题的算术平均值，并保留两位小数，范围为 1–5。Big Five 每维 4 题，AI 三个维度每维 3 题。

反向计分是必要的：它使方向相反的题在维度平均前回到同一方向。反向题若未正确处理，会直接改变维度结果，因此评分逻辑与单元测试被放在 `src/utils/scoring.ts` 和 `src/utils/scoring.test.ts`。

结果页面显示 Big Five 雷达图、AI 态度条形图、每个维度的分数与谨慎的文字说明。它不提供心理、医学或临床诊断。

## 5. What technologies did I use?

- Vue 3、TypeScript、Vite
- Supabase PostgreSQL、Supabase Auth、Row Level Security
- ECharts
- Vitest、ESLint、vue-tsc
- Git/GitHub、Vercel
- Codex / Agentic AI

## 6. How did I use agentic AI?

项目代码高度依赖 Codex / Agentic AI。作者主要负责把开放需求拆解为可执行问题、与 AI 多轮交互、确认方案、配置服务、审查结果、手工测试和推动修正。实际开发不是一次性接受生成结果，而是“提出目标 -> 检查实现 -> 测试 -> 发现问题 -> 修正需求 -> 再验证”的循环。

三个可核对的案例是：将评分从 UI 分离并加入 Vitest；发现匿名认证开关未正确开启后在 Supabase 控制台修正；发现早期过宽 RLS 思路后，要求改为 `auth.uid()` 所有权与 researcher whitelist。详见 [AI Development Record](./AI_DEVELOPMENT_LOG.md)。

## 7. What did I learn from the participants?

当前工程中未找到要求分析的 `docs/pilot/final_pilot_data.csv`，Git 已追踪文件和工作目录中也没有该路径。因此无法从当前证据确认 completed participant count、完成时长、反馈内容、可用性观察或异常作答模式。不能将 README 中的“至少 10 人”目标或外部口头信息写成已验证的 pilot 结果。

## 8. What problems did I encounter?

可从工程记录确认的问题包括：Anonymous Auth provider 未正确开启导致匿名登录失败；早期 RLS 设计可能过宽；以及需要将评分逻辑独立出来才能进行可重复测试。README 还记录了一个部署层面的现实限制：Vercel-hosted site 在中国大陆部分网络环境可能不可访问或不稳定。当前工程没有足够证据证明该限制已被解决。

## 9. What mistakes did the AI agent make?

最重要的已记录案例是安全模型：早期 AI 输出曾使用过宽的 `using(true)` / `with check(true)` 思路，并把 authenticated 角色等同于研究者。前者不验证参与者是否拥有该 session；后者错误地忽略了 Anonymous Auth 用户也可能属于 authenticated 角色。这可能让匿名参与者读取不应读取的研究数据，因此是严重安全问题。

除开发记录明确记载的事项外，本报告不推断或罗列其他 AI 错误。

## 10. How did I verify and correct those mistakes?

当前 schema 用 `participant_uid = auth.uid()` 限制 participant session，子表策略通过父 session 验证所有权。`researchers` 表和 `is_researcher()` 单独确认研究者身份，研究者只拥有读取策略。README 给出了使用不同浏览器、无痕窗口、未授权登录和 researcher 登录进行 RLS 验证的手工步骤。

代码验证包括评分和质量筛查单元测试、TypeScript 类型检查、ESLint 与生产构建。固定全 5 答案还提供了手工预期值交叉检查。当前工程无法证明真实生产环境的每条 RLS 测试已经由作者逐项执行，因此该项仍应在提交前手工确认。

## 11. If I had another week, what would I improve?

下一步可以招募更大的样本、使用更成熟且许可清晰的中文人格工具、进行更谨慎的心理测量评估、解释为什么将 AI 态度和人格题同时呈现、改善中国大陆网络环境下的可访问性、扩展移动端和集成测试，并把数据质量规则发展为经研究设计支持的方法。这些均是未来工作，不是已经完成的成果。
