# 项目网址

公网：https://zhangshi-lab.vercel.app/
国内访问：https://personality-test.edgeone.dev/

# Agentic AI Web Assessment

一个 Vue 3 + TypeScript + Vite 的匿名网页测评原型，服务于 Agentic AI Web Assessment Challenge。它测量 Big Five 人格倾向和与 AI 学习/研究相关的探索性态度，并提供研究者数据面板。

## 测量内容

- Big Five：开放性、尽责性、外向性、宜人性、情绪敏感性。
- AI attitudes：感知学习收益、风险/批判性关注、主动使用 AI 的行为倾向。

Big Five 是 established personality framework。本项目的 20 道人格题是基于公开的 IPIP Big-Five factor markers 所作的简短中文教育性改写，每维 4 题，包含正反向项目。它不是正式翻译版量表，未进行信度、效度或跨文化等价性验证。

AI 态度部分是本项目自行编制的 9 道探索性题项；不将其描述为经过正式验证的量表。选择这些构念是为了研究人们是否同时感到 AI 的学习收益、风险，以及是否采取主动核查和提示策略。

## 评分与结果

每题均为 1–5 Likert：1 非常不同意、2 不同意、3 不确定、4 同意、5 非常同意。

正向题直接计分；反向题严格使用 scored = 6 - rawScore。维度分为该维度所有有效计分题的平均值，范围始终为 1–5。纯函数实现位于 [src/utils/scoring.ts](E:/Desktop/9.12/personality-test/src/utils/scoring.ts)。

参与者结果包含 Big Five 雷达图、AI 态度条形图及限定语气的解释，例如“本次回答显示……倾向”。结果仅供教育和研究探索，绝不构成心理、医学或临床诊断。

## 架构

- src/data/questions.ts：数据驱动题库（id、text、construct、dimension、reverse、order、source）。
- src/utils/scoring.ts：独立评分、完成校验、题库完整性校验。
- src/utils/analytics.ts：均值、Cronbach's alpha、相关与仪表板统计。
- src/services/assessmentRepository.ts：Supabase 优先、localStorage 仅开发回退的数据层。
- src/components/ChartPanel.vue：ECharts 图表容器。
- src/App.vue：参与者流程、结果、反馈和受限研究者面板。

## 隐私与知情同意

平台只保存随机生成的匿名 session ID、答题数据、计分维度、开始/完成时间、完成时长和可选 pilot feedback。不收集姓名、手机号、学号、邮箱、IP 或其他不必要身份信息。

首页明确说明教育/研究用途、匿名性、数据用途、非诊断性质，且用户必须勾选主动同意后才能开始。

## Supabase 正式数据收集

正式 pilot 必须配置 Supabase；localStorage 回退只适合开发和单机界面验证，不能用于跨设备收集 10 名独立参与者数据。

1. 在 Supabase 新建项目。
2. 在 SQL Editor 执行 [supabase/schema.sql](E:/Desktop/9.12/personality-test/supabase/schema.sql)。
3. 在 Supabase Authentication 的 Providers 中启用 Anonymous Sign-Ins。
4. 创建一个 Supabase Auth 的 researcher 用户，并在 SQL Editor 以项目管理员身份执行：insert into public.researchers (user_id) values ('该用户的 auth.users.id')。
5. 复制 .env.example 为 .env.local，填写 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。

anon key 可出现在浏览器环境变量中；绝不可将 Supabase service_role secret 放进前端或仓库。

### Anonymous authentication 与 researcher authorization

参与者进入测评时，前端调用 Supabase Anonymous Auth。此过程生成匿名 auth user，不要求姓名、邮箱或密码；其 JWT 的数据库角色仍是 authenticated，但这不代表研究者权限。

每一个 assessment_sessions 行保存 participant_uid = auth.uid()。RLS 允许参与者只创建、读取和更新 participant_uid 等于自身 auth.uid() 的 session；responses、dimension_scores 和 feedback 的读写会通过父 session 验证同一所有权。因此普通参与者无法枚举或读取他人的答题、得分和反馈。

researcher authorization 是独立步骤：只有 user_id 存在于 public.researchers 的 Supabase Auth 用户，才会使 is_researcher() 返回 true。仅这些用户可读取全部研究数据；普通 authenticated 用户和 Anonymous Auth 用户都不能获得该权限。researchers 表没有向客户端授予直接 SELECT 权限。

schema.sql 明确 REVOKE 了 anon/authenticated 的默认表权限，再仅向 authenticated 授予所需的 SELECT/INSERT/UPDATE；RLS 是最终决定层。研究者只有读取策略，没有写入或删除策略。

未配置 Supabase 时，可设置 VITE_ADMIN_PASSWORD 查看本地开发数据；这是 demo-level 前端门禁，不能作为真实研究数据的安全认证。

## 本地运行

运行 npm install，然后 npm run dev。默认地址为 http://localhost:5174/。

生产验证依次运行：npm run typecheck、npm run lint、npm test、npm run build。

## 部署

### GitHub 上传前

项目的 .gitignore 会排除 .env.local、所有本地 .env 变体、node_modules 和 dist，同时保留 .env.example。提交前运行 git status，确认真实 Supabase URL、anon key、VITE_ADMIN_PASSWORD 与任何 researcher 凭据均未出现在待提交列表。前端源码不包含 service_role key。

### Vercel

这是一个 Vue 3 + Vite 静态站点。Vercel 可自动识别 Vite；使用 Build Command：npm run build，Output Directory：dist。项目采用 hash 路由（/#/、/#/admin），浏览器刷新不会请求服务器端嵌套路由，因此不需要 vercel.json 重写规则。

在 Vercel 项目的 Production、Preview 和 Development 环境中配置：

1. VITE_SUPABASE_URL
2. VITE_SUPABASE_ANON_KEY

生产环境不要配置 VITE_ADMIN_PASSWORD。只有 Supabase 未配置时，代码才会使用此本地 demo fallback；已配置 Supabase 时研究者入口始终走 Supabase Auth 与 researchers 白名单。

将项目导入 GitHub 后部署，环境变量保存后应重新部署。部署前应从正式域名手工完成一次匿名测评和 researcher 登录验证。

研究者使用 /#/admin 访问后台：Supabase 已配置时先以 Supabase Auth 登录，再由 researchers 白名单确认授权；本地开发回退模式则使用 .env.local 内的演示密码。

### RLS 权限验证步骤

1. 以未登录浏览器访问表 API：请求应被拒绝，因为没有 authenticated JWT。
2. 在浏览器 A 开始测评，确认 Anonymous Auth 创建了用户 A，并插入 participant_uid 为用户 A 的 session。
3. 用浏览器 B 或无痕窗口创建匿名用户 B；尝试按 session ID 查询或更新 A 的 session，以及向 A 的 responses、dimension_scores、feedback 插入记录，均应返回 RLS 拒绝或空结果。
4. 让用户 A 查询自己的 session 和子表数据，应只返回 A 的记录。
5. 用已注册但未插入 researchers 表的普通邮箱用户登录 /#/admin；登录会被前端拒绝，直接查询全部表也会被 RLS 拒绝。
6. 在 SQL Editor 将研究者用户 UUID 插入 researchers 表后，重新登录该用户；/#/admin 应能读取聚合数据与导出。
7. 用研究者 JWT 尝试 INSERT/UPDATE/DELETE 参与者业务表；由于没有对应 RLS 写策略，操作应被拒绝。

## 测试与验证

Vitest 测试位于 [src/utils/scoring.test.ts](E:/Desktop/9.12/personality-test/src/utils/scoring.test.ts)，覆盖：

- 正向与反向题的 5 -> 5、5 -> 1、1 -> 5、3 -> 3。
- 维度均分。
- 固定全 5 答案的人工预期结果。
- 未回答全部必答题不能提交。
- 题目 ID、顺序和维度映射无重复/遗漏。
- 每一个反向题都进入反向计分。
- 完整结果范围为 1–5。

仪表板保留 alpha 与开放性—AI 收益相关，但明确显示它们是 exploratory / unstable，尤其在少于 10 个完成样本时。它们不构成正式心理测量验证，也不支持因果解释。

## Pilot 数据质量检查

研究者后台会对已完成的 29 题作答做非破坏性的 pilot 数据质量标记，不会自动删除、隐藏或改写任何参与者数据。质量逻辑位于 src/utils/dataQuality.ts，检查：

- 完成时间小于 60 秒。
- 最长连续相同原始回答达到 15 题。
- 单一选项占全部 29 题的比例达到 85%。
- 全部原始回答的标准差小于 0.5。
- questions.ts 中明确配置的正反向配对里，至少两对出现同时高同意或同时高不同意。

每项触发规则计 1 个风险点：0–1 为 normal，2 为 review，3 或以上为 likely_invalid。仪表板会显示各等级数量、最近提交的触发原因，并提供 Exclude likely invalid 开关；该开关只从聚合统计排除 likely_invalid，保留 review。CSV/JSON 导出包含 quality_level、quality_score 与 quality_reasons。

这些规则只能用于 pilot 阶段的数据质量筛查，不等同于正式心理测量研究中的无效作答识别，也不能证明参与者“故意乱填”。

## Pilot 评价流程

1. 完成 Supabase 配置和部署。
2. 让至少 10 位独立匿名参与者从正式链接完成测评和可选反馈。
3. 用 researcher dashboard 检查 completed participants、completion rate、时长、分布和反馈。
4. 导出 CSV/JSON；导出包含匿名 session ID、完成时间、时长、原始回答、维度得分和反馈。
5. 在报告中将该过程写为可用性/数据流程的 pilot，而不是量表效度证明。

## 局限与后续工作

- 当前中文题目是简化教育实现，不等同于正式 IPIP 或 BFI 中文量表。
- 10 人 pilot 只能帮助发现可用性与流程问题，不能证明信度或效度。
- 对公开部署，应由研究者根据机构伦理要求审查知情同意、保留期限、删除流程和 Supabase RLS 策略。
- 后续可加入经过许可的标准化中文题库、预注册分析计划、样本量设计和更细粒度的 researcher 权限。

## AI 辅助开发

见 [AI_DEVELOPMENT_LOG.md](E:/Desktop/9.12/personality-test/AI_DEVELOPMENT_LOG.md)。该日志区分本次实际观察到的问题与尚待人工审查的潜在风险。
