# AI-Assisted Development Log

此文件是供项目作者继续维护的真实记录结构，不把未发生的事件写成事实。

## Interaction 1

- Goal：将本地 Vue 测评原型升级为符合 Agentic AI Web Assessment Challenge 的可收集数据 pilot 原型。
- Prompt / instruction：用户提供的导师需求，要求 Supabase 数据层、独立评分测试、结果图表、反馈、受限后台、README 与验证。
- What Codex changed：新增数据驱动题库、评分/统计纯函数、Vitest 测试、Supabase schema 与 repository、ECharts 图表、hash admin route、匿名 feedback 和导出。
- How I verified it：首次运行 npm test 时，6 项测试中有 2 项失败；运行 npm run typecheck 已通过。修正后运行 npm test（6/6 passed）、npm run typecheck、npm run lint 和 npm run build，全部通过。浏览器预览确认首页知情同意、29 题概览和受限研究者入口可见。
- Problem found：旧实现在 App.vue 内直接定义题目、计算分数、统计和 localStorage 操作，评分逻辑无法单独单元测试；后台入口也直接出现在参与者主导航中。
- Correction：评分迁移至 src/utils/scoring.ts，题库迁移至 src/data/questions.ts，后台改为 /#/admin 并通过 Supabase Auth 或本地演示密码门禁。
- Verification after correction：固定全 5 答案的手工核算与单测一致：五个人格维度均为 3.00；AI 收益感为 3.67、风险关注为 5.00、主动使用能力为 3.67。npm test、npm run typecheck、npm run lint、npm run build 均已通过。
- What I learned：将高风险评分逻辑与 UI 分离，才能把心理测评原型的计算过程转化为可检查、可复现的代码。

## Potential risks requiring human review

- Actual observed issue：旧 schema.sql 对 assessment_sessions 使用 using(true) / with check(true)，且将所有 authenticated 用户视为可读取研究数据；这没有 session 所有权控制，也会在启用 Anonymous Auth 后造成数据暴露。现已改为 participant_uid = auth.uid() 和 researchers 白名单检查。
- supabase/schema.sql 中 RLS 策略应在部署前由研究者按所属机构的安全与伦理要求复核，并按 README 的权限验证步骤实际测试。
- IPIP marker 的中文教育性改写并非正式翻译或验证版本；任何研究报告必须保留这一限制。
- 尚未进行真实 10 人 pilot，不能在报告或界面中声称已完成。
