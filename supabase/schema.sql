-- Agentic AI Web Assessment: anonymous-authentication security model.
-- Run in the Supabase SQL Editor before collecting formal pilot data.
-- The Vite client uses only the public anon key. Never expose service_role.

create table if not exists public.assessment_sessions (
  id uuid primary key,
  participant_uid uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_seconds integer check (completion_seconds is null or completion_seconds >= 0),
  status text not null check (status in ('in_progress', 'completed')),
  created_at timestamptz not null default now()
);

-- Makes an existing pre-security table compatible. Existing unowned rows remain
-- inaccessible through RLS and must be handled deliberately before making this
-- column NOT NULL in a production migration.
alter table public.assessment_sessions
  add column if not exists participant_uid uuid references auth.users(id) on delete restrict;

create table if not exists public.responses (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  question_id text not null,
  raw_score smallint not null check (raw_score between 1 and 5),
  scored_score smallint not null check (scored_score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table if not exists public.dimension_scores (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  dimension text not null,
  score numeric(3,2) not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (session_id, dimension)
);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  session_id uuid not null unique references public.assessment_sessions(id) on delete cascade,
  questions_clear smallint not null check (questions_clear between 1 and 5),
  platform_easy smallint not null check (platform_easy between 1 and 5),
  result_clear smallint not null check (result_clear between 1 and 5),
  length_appropriate smallint not null check (length_appropriate between 1 and 5),
  confusing_part text,
  improvement text,
  created_at timestamptz not null default now()
);

-- This table is managed in the SQL Editor by the project owner. Do not grant
-- clients direct read access; is_researcher() is the only client-facing check.
create table if not exists public.researchers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists assessment_sessions_participant_uid_idx
  on public.assessment_sessions (participant_uid);
create index if not exists assessment_sessions_status_started_at_idx
  on public.assessment_sessions (status, started_at desc);
create index if not exists responses_session_id_idx on public.responses (session_id);
create index if not exists dimension_scores_session_id_idx on public.dimension_scores (session_id);
create index if not exists feedback_session_id_idx on public.feedback (session_id);

-- Runs as the function owner so clients need no SELECT privilege on researchers.
-- The explicit search_path prevents a caller-controlled object from being used.
create or replace function public.is_researcher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.researchers
    where user_id = (select auth.uid())
  );
$$;

revoke all on table public.assessment_sessions, public.responses,
  public.dimension_scores, public.feedback, public.researchers
  from anon, authenticated;
revoke all on function public.is_researcher() from public;

grant usage on schema public to authenticated;
grant select, insert, update on public.assessment_sessions to authenticated;
grant select, insert on public.responses, public.dimension_scores to authenticated;
grant select, insert, update on public.feedback to authenticated;
grant usage, select on sequence public.responses_id_seq,
  public.dimension_scores_id_seq, public.feedback_id_seq to authenticated;
grant execute on function public.is_researcher() to authenticated;

alter table public.assessment_sessions enable row level security;
alter table public.responses enable row level security;
alter table public.dimension_scores enable row level security;
alter table public.feedback enable row level security;
alter table public.researchers enable row level security;

drop policy if exists "anon can create sessions" on public.assessment_sessions;
drop policy if exists "anon can complete own submitted session" on public.assessment_sessions;
drop policy if exists "authenticated researchers can read sessions" on public.assessment_sessions;
drop policy if exists "anon can write responses" on public.responses;
drop policy if exists "authenticated researchers can read responses" on public.responses;
drop policy if exists "anon can write dimension scores" on public.dimension_scores;
drop policy if exists "authenticated researchers can read scores" on public.dimension_scores;
drop policy if exists "anon can write feedback" on public.feedback;
drop policy if exists "authenticated researchers can read feedback" on public.feedback;

-- assessment_sessions: anonymous participants can only access their own rows.
create policy "participants read own sessions"
  on public.assessment_sessions for select to authenticated
  using (participant_uid = (select auth.uid()));
create policy "participants create own sessions"
  on public.assessment_sessions for insert to authenticated
  with check (participant_uid = (select auth.uid()));
create policy "participants update own sessions"
  on public.assessment_sessions for update to authenticated
  using (participant_uid = (select auth.uid()))
  with check (participant_uid = (select auth.uid()));

-- Child rows are usable only if their parent session belongs to auth.uid().
create policy "participants read own responses"
  on public.responses for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = responses.session_id
      and sessions.participant_uid = (select auth.uid())
  ));
create policy "participants write own responses"
  on public.responses for insert to authenticated
  with check (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = responses.session_id
      and sessions.participant_uid = (select auth.uid())
  ));

create policy "participants read own dimension scores"
  on public.dimension_scores for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = dimension_scores.session_id
      and sessions.participant_uid = (select auth.uid())
  ));
create policy "participants write own dimension scores"
  on public.dimension_scores for insert to authenticated
  with check (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = dimension_scores.session_id
      and sessions.participant_uid = (select auth.uid())
  ));

create policy "participants read own feedback"
  on public.feedback for select to authenticated
  using (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = feedback.session_id
      and sessions.participant_uid = (select auth.uid())
  ));
create policy "participants write own feedback"
  on public.feedback for insert to authenticated
  with check (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = feedback.session_id
      and sessions.participant_uid = (select auth.uid())
  ));
create policy "participants update own feedback"
  on public.feedback for update to authenticated
  using (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = feedback.session_id
      and sessions.participant_uid = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.assessment_sessions sessions
    where sessions.id = feedback.session_id
      and sessions.participant_uid = (select auth.uid())
  ));

-- Researchers are approved individually through public.researchers, not by
-- membership in the broad authenticated role. They have read-only access.
create policy "researchers read all sessions"
  on public.assessment_sessions for select to authenticated
  using ((select public.is_researcher()));
create policy "researchers read all responses"
  on public.responses for select to authenticated
  using ((select public.is_researcher()));
create policy "researchers read all dimension scores"
  on public.dimension_scores for select to authenticated
  using ((select public.is_researcher()));
create policy "researchers read all feedback"
  on public.feedback for select to authenticated
  using ((select public.is_researcher()));
