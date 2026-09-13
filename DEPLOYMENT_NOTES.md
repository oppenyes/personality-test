# Deployment Notes

## Deployment structure

- Frontend: Vercel 静态部署。README 中记录的公开地址为 https://zhangshi-lab.vercel.app/
- Backend: Supabase（PostgreSQL、Auth、RLS）。
- Source control: Git/GitHub。

当前路由采用 Vue Router hash history，因此首页为 `/#/`，研究者后台为 `/#/admin`。刷新后台不会让 Vercel 请求服务器端嵌套路由，当前工程不需要 `vercel.json` 重写规则。

## Vercel settings

- Build command: `npm run build`
- Output directory: `dist`
- Production environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

不应在 Vercel 或前端源码中配置 Supabase `service_role` key。`VITE_SUPABASE_ANON_KEY` 是浏览器可使用的公开 anon key；真正的数据访问边界仍由 Supabase Auth 和 RLS 决定。

`VITE_ADMIN_PASSWORD` 仅用于未配置 Supabase 时的本地 demo fallback。正式环境不应配置它；Supabase 已配置时，研究者入口走 Supabase Auth 加 researcher whitelist，而不是该 demo 密码。

## Supabase setup

1. 在 SQL Editor 执行 `supabase/schema.sql`。
2. 在 Authentication Providers 中开启 Anonymous Auth。
3. 为研究者创建 Supabase Auth 账号。
4. 将该账号的 `auth.users.id` 插入 `public.researchers`。
5. 从部署域名完成一次匿名测评，并验证研究者可登录 `/#/admin`。

Anonymous Auth 为没有姓名、邮箱或密码的参与者建立身份；session 记录 `participant_uid`。RLS 让参与者仅读写自己的 session 和对应子记录。researcher whitelist 通过 `researchers` 表与 `is_researcher()` 实现；authenticated 并不自动等同于研究者。

## Known Deployment Limitation

README 的现有记录指出：Vercel-hosted site may be inaccessible or unstable on some networks in mainland China。这不代表应用逻辑失败，但会影响目标参与者的可访问性。当前工程没有证据表明已部署或验证稳定的中国大陆替代版本；后续可根据目标用户网络环境选择更适合的 hosting/CDN。

## Pre-release checklist

- 检查 `.gitignore`，确认 `.env.local` 和其他真实环境变量文件未提交，`.env.example` 被保留。
- 在 Vercel 的 Production、Preview 和 Development 环境中配置上述两个变量，并重新部署。
- 确认前端没有 service_role key、研究者密码或其他私密凭据。
- 以独立浏览器/无痕窗口验证 participant A 不能读取 participant B。
- 以未列入 `researchers` 的普通账户验证不能读取 dashboard；以白名单研究者验证 dashboard 与导出。
