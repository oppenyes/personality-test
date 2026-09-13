# 项目作者快速理解手册

## 1. 这个项目一句话是干什么的？

这是一个匿名网页测评：参与者回答 29 道人格与 AI 学习态度题，网站给出本次回答的分数图表；研究者可在受权限保护的后台查看汇总数据和导出。

## 2. 用户打开网站以后发生了什么？

1. 首页显示知情同意，用户勾选后才能开始。
2. `assessmentRepository.ts` 调用 Supabase Anonymous Auth，浏览器得到一个匿名身份。
3. 网站创建一条 `assessment_sessions` 记录，并把这个匿名身份的 UID 存到 `participant_uid`。
4. 用户完成 29 道 1–5 分题；`App.vue` 的响应式状态保存当前答案和题号。
5. 提交时，`scoring.ts` 计算维度分数；repository 保存 session、responses 和 dimension_scores。
6. 结果页显示 Big Five 雷达图和 AI 态度条形图，并可填写匿名 feedback。

## 3. Vue 3、TypeScript 和 Vite 是什么？

Vue 3 是页面的组织方式。本项目的 `App.vue` 同时保存页面状态、按钮点击后的动作和显示模板；答案变了，进度、分数和图表会自动更新。TypeScript 是给数据加“类型标签”的 JavaScript，例如 `LikertScore` 只能是 1 到 5，能更早发现错误。Vite 是开发服务器和打包工具：`npm run dev` 让你在本机看页面，`npm run build` 生成可部署的 `dist` 文件夹。

## 4. Supabase 是干什么的？

Supabase 提供三件事：Database 是存数据的数据库；Auth 是登录/匿名身份系统；RLS 是数据库门口的规则。可以把 Auth 想成给每个浏览器一张身份卡，RLS 想成保安核对这张卡能否打开某一条数据。

## 5. 数据库里每张表是干什么的？

- `assessment_sessions`：一次测评的开始时间、完成时间、状态、时长和匿名身份 UID。
- `responses`：每一道题的原始分和计分后的分，关联到一个 session。
- `dimension_scores`：一次测评的 8 个维度分数，关联到一个 session。
- `feedback`：四个反馈评分和两段可选文字，关联到一个 session。
- `researchers`：研究者白名单，只保存获授权 Auth 用户的 UID。

一个 session 可以有很多 responses 和 dimension_scores，最多有一条 feedback。

## 6. Anonymous Auth 和 RLS 为什么重要？

Anonymous Auth 不要求参与者输入邮箱或密码，但 Supabase 仍给这个浏览器一个 `auth.uid()`。`participant_uid` 记录这个 UID。RLS 检查访问者的 `auth.uid()` 是否等于该条 session 的 `participant_uid`，所以参与者 A 不能读写参与者 B 的数据。

研究者也不是“只要登录就行”。`researchers` 表是白名单，`is_researcher()` 只在当前 UID 位于白名单时返回 true。Anonymous Auth 用户也可能拥有 authenticated JWT，所以 `authenticated != researcher`。

早期 AI 方案曾有 `using(true)` / `with check(true)` 的过宽思路。这相当于保安不核对身份。现在的 schema 用所有权和白名单替代它；这是作者需要能够向老师清楚说明的 AI 错误案例。

## 7. 29 道题如何计分？

每题原始回答是 1 到 5。正向题直接用原始分；反向题用 `6 - 原始分`。例如反向题回答 5，计分就是 1；回答 2，计分就是 4。然后把同一个维度中的题目取平均。

Big Five 是开放性、尽责性、外向性、宜人性和情绪敏感性，每项各 4 题。AI 部分是 AI 学习收益感、AI 风险关注和 AI 主动使用能力，每项各 3 题。全选 5 不一定得到 5 分，因为反向题会被反向处理。

## 8. 后台统计在做什么？

`analytics.ts` 汇总参与者数、完成率、平均完成时间、维度均值、题目分布、feedback 平均评分、最近提交和开放性与 AI 收益感的相关。它还计算 Cronbach's alpha；可以把 alpha 粗略理解为“同一维度内几道题是否倾向于一起变化”。小样本下 alpha 非常不稳定，所以这里仅是 exploratory。相关也只表示两个数字一起变化的程度，correlation 不等于 causation，尤其不能用很小的样本推断总体。

## 9. Data Quality 怎么判断？

它是 rule-based response quality screening，不是“乱填检测”。完成时间少于 60 秒、连续同分至少 15 题、一个选项占至少 85%、原始分标准差低于 0.5、或至少两对明确配置的反向题严重矛盾，都会各加一个风险点。0–1 是 normal，2 是 review，3 或以上是 likely_invalid。它不删除数据；后台的开关只把 likely_invalid 从聚合统计暂时排除，review 仍保留。

## 10. 网站部署在哪里？环境变量是什么？

GitHub 放源代码，Vercel 把前端部署为公网网页，Supabase 负责身份和数据库。Vercel 需要 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。anon key 可以出现在前端，因为 RLS 仍限制数据；service_role key 能绕过 RLS，绝对不能放进前端、GitHub 或 Vercel 的 `VITE_` 变量。

## 11. 如何添加研究者账户？

先在 Supabase Authentication 创建研究者账号，找到该账号 UID，然后在 SQL Editor 执行：

```sql
insert into public.researchers (user_id) values ('研究者 UID');
```

之后使用该账号在 `/#/admin` 登录。不要把真实密码写入 README、代码或截图。

## 12. 如果老师问“这个项目哪里是你做的？”

可以诚实回答：我没有手工编写绝大多数代码。我负责把开放问题拆解成明确需求，与 Codex 多轮交互，选择方案，配置 Supabase 和部署环境，执行 SQL，测试系统，检查 AI 输出，并在发现匿名认证和 RLS 安全问题后要求修正。这个 challenge 考察的不只是手写代码，也考察能否有效指导、验证和纠正 agentic AI。

## 13. 如果老师问“你怎么知道 AI 写的是对的？”

回答应包括：评分单元测试和全 5 手工核算；`npm test`、`npm run typecheck`、`npm run lint`、`npm run build`；审查 RLS；用不同浏览器验证 participant/researcher 权限；以及真实 pilot 数据（仅在 CSV 实际可用时引用）。AI 输出需要验证，不能因为页面能打开就认为正确。

## 14. 这个系统哪里可能还不够？

真实限制包括：简化的人格题与探索性 AI 态度题未作正式验证；小 pilot 不能推广；alpha 与相关在小样本下不稳定；质量规则只是启发式；生产级集成/RLS 测试仍需要逐项手工执行；中国大陆网络可能影响 Vercel 可访问性。当前交付包还缺少最终 pilot CSV，因此不能确认任何 pilot 数字。

## 15. 常用命令速查

- `npm install`：安装依赖。
- `npm run dev`：启动本机开发网站。
- `npm test`：运行自动单元测试。
- `npm run typecheck`：检查 TypeScript 类型是否匹配。
- `npm run lint`：检查代码规范和常见错误。
- `npm run build`：模拟生产打包，生成 `dist`。

## 16. 关键文件地图

- `src/App.vue`：参与者页面、结果、feedback、研究者面板。
- `src/data/questions.ts`：29 道题、维度名称、反向题标记。
- `src/utils/scoring.ts`：反向计分与维度平均。
- `src/utils/dataQuality.ts`：质量筛查规则。
- `src/utils/analytics.ts`：后台汇总、alpha、相关和题目分布。
- `src/services/assessmentRepository.ts`：Supabase/Auth/本地开发回退的数据读写。
- `supabase/schema.sql`：数据库表、索引、授权和 RLS。
- `src/utils/*.test.ts`：评分与质量规则测试。

## 17. 出问题时先看哪里？

- 页面打不开：确认 `npm run dev` 是否运行，或 Vercel 部署是否成功。
- Supabase 连不上：检查 `.env.local` 的 URL 和 anon key，修改后重启开发服务器。
- 匿名用户创建失败：确认 Supabase 的 Anonymous Auth provider 已开启。
- 问卷不能提交：确认 29 题都已回答，并查看页面错误提示。
- 后台登录失败：确认 Auth 账号密码和 `researchers` 白名单 UID。
- 后台看不到数据：确认 SQL schema 已执行、当前用户是白名单 researcher、RLS 策略未被改坏。
- build 失败：先运行 typecheck 和 lint，按首个报错定位文件。

## 18. 10 分钟提交前复习清单

1. 能画出 GitHub -> Vercel -> Supabase 的架构。
2. 能说明 29 题、1–5 Likert、反向题 `6 - raw` 和维度平均。
3. 能解释 Anonymous Auth、`auth.uid()`、RLS 与 researcher whitelist。
4. 能说明 AI 曾给出过宽 RLS 思路，以及如何修正。
5. 能说明 pilot 只是小型流程/可用性检查，不能作为量表 validation。
6. 只引用实际 CSV 中能重算出的 pilot 数字；CSV 缺失时明确说无法确认。
