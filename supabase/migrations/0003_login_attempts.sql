-- 0003_login_attempts.sql — brute-force protection for the admin login (P4-3)
--
-- WHY: /api/auth/login had no rate limiting at all. An attacker could guess the
-- admin password at network speed, and the credential was compared with a plain
-- `===`. That was tolerable while the admin was read-only; it stops being
-- tolerable the moment the admin can write live API keys.
--
-- WHY SUPABASE AND NOT AN IN-MEMORY COUNTER: on Vercel each lambda has its own
-- memory and cold-starts constantly, so an in-process counter resets itself and
-- is not shared across instances — i.e. it would not actually limit anything.
--
-- RETENTION: rows are only useful inside the lockout window. `prune_login_attempts`
-- below is called opportunistically by the login route so the table cannot grow
-- without bound; there is no cron dependency.

create table if not exists public.login_attempts (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  -- Client IP as seen by Vercel (x-forwarded-for, first hop). Null when it
  -- cannot be determined — those rows still count toward the global window so
  -- a missing header is not a way around the limit.
  ip text,
  -- Whether this attempt succeeded. Successful logins are recorded too, so the
  -- admin panel can show "last login" and so a success can clear the window.
  ok boolean not null
);

comment on table public.login_attempts is
  'Admin login attempts, used for brute-force rate limiting by lib/login-rate-limit.ts. Never stores the submitted email or password.';

create index if not exists login_attempts_ip_ts_idx on public.login_attempts (ip, ts desc);
create index if not exists login_attempts_ts_idx on public.login_attempts (ts desc);

-- Service-role-only, same posture as api_calls and budget_state: RLS on with no
-- policies, plus the grants revoked from the client roles.
alter table public.login_attempts enable row level security;
revoke all on table public.login_attempts from anon, authenticated;

-- Opportunistic cleanup. Deliberately keeps a day rather than just the lockout
-- window, so a failed-login spike is still visible after the fact.
create or replace function public.prune_login_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where ts < now() - interval '1 day';
$$;

revoke all on function public.prune_login_attempts() from anon, authenticated;
