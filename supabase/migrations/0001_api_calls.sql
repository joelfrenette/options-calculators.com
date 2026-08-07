-- 0001_api_calls.sql — per-call API metering (AUDIT_BACKLOG S-19)
--
-- One row per outbound API call made through lib/metered-fetch.ts.
-- Written by the server only (service role); no client access.

create table if not exists public.api_calls (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  provider text not null,
  route text,
  status int,
  ms int,
  ok boolean
);

comment on table public.api_calls is
  'One row per outbound API call, written fire-and-forget by lib/metered-fetch.ts.';

create index if not exists api_calls_provider_ts_idx
  on public.api_calls (provider, ts);

-- Service-role-only writes (and reads):
-- RLS is enabled with NO policies, so anon/authenticated can do nothing.
-- The service role bypasses RLS, so only server code holding
-- SUPABASE_SERVICE_ROLE_KEY can insert or query. Belt-and-braces: revoke
-- the table grants from the client roles as well.
alter table public.api_calls enable row level security;
revoke all on table public.api_calls from anon, authenticated;

-- Daily rollup per provider. security_invoker so the view offers no way
-- around the table's RLS: only the service role can read it.
create or replace view public.api_calls_daily
with (security_invoker = on) as
select
  date_trunc('day', ts)::date as day,
  provider,
  count(*)::int as calls,
  round(avg(ms))::int as avg_ms,
  (count(*) filter (where ok is distinct from true))::int as errors
from public.api_calls
group by 1, 2
order by 1 desc, 2;

comment on view public.api_calls_daily is
  'Per-day, per-provider rollup of api_calls: call count, average latency, error count.';

revoke all on public.api_calls_daily from anon, authenticated;
