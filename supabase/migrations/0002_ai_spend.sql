-- 0002_ai_spend.sql — token accounting + the budget-guard kill flag (E-5)
--
-- WHY: 0001 metered outbound fetches, which covered polygon / fmp / finnhub —
-- all FLAT-RATE plans whose marginal cost is $0. The providers that can
-- actually run a bill up are the pay-per-use LLMs, and those do not go through
-- fetch() at all: they go through the Vercel AI SDK. The ledger was therefore
-- blind to the only spend worth guarding. These columns close that gap.
--
-- AI rows land in the same api_calls table (provider = "openai", "anthropic",
-- "xai", "openrouter", "perplexity", ...) with the token columns populated.
-- Non-AI rows leave them null.

alter table public.api_calls
  add column if not exists model text,
  add column if not exists input_tokens int,
  add column if not exists output_tokens int,
  -- Marginal USD for this call. NULL means "we could not price it" — never 0.
  -- lib/api-costs.ts estimateAiCallCost() returns null for an unknown model,
  -- and cost_known below records that distinction explicitly so an unpriced
  -- paid model can never be summed as free.
  add column if not exists cost_usd numeric(12, 6),
  add column if not exists cost_known boolean;

comment on column public.api_calls.cost_usd is
  'Estimated marginal USD for this call (lib/api-costs.ts list prices). NULL = unpriced, not free.';
comment on column public.api_calls.cost_known is
  'False when the model had no price on file. Counted separately by the budget guard.';

-- Spend rollup the guard reads. Sums only rows we could actually price, and
-- reports the unpriced count alongside so the total is never mistaken for
-- complete when a model is missing from the price table.
create or replace view public.api_spend_daily
with (security_invoker = on) as
select
  date_trunc('day', ts)::date as day,
  provider,
  count(*)::int as calls,
  coalesce(sum(cost_usd) filter (where cost_known is true), 0)::numeric(12, 6) as cost_usd,
  (count(*) filter (where cost_known is false))::int as unpriced_calls,
  coalesce(sum(input_tokens), 0)::bigint as input_tokens,
  coalesce(sum(output_tokens), 0)::bigint as output_tokens
from public.api_calls
group by 1, 2
order by 1 desc, 2;

comment on view public.api_spend_daily is
  'Per-day, per-provider spend rollup: priced USD total, unpriced call count, token totals.';

revoke all on public.api_spend_daily from anon, authenticated;

-- Index for the guard's day/month window scans.
create index if not exists api_calls_ts_idx on public.api_calls (ts);

-- ---------------------------------------------------------------- kill flag
--
-- Single-row table holding the budget guard's state. Durable and shared across
-- serverless instances, which an env var or in-memory flag could not be:
-- DISABLED_APIS requires a redeploy to change, and a lambda-local flag would be
-- lost on the next cold start — i.e. the shutoff would silently un-trip.

create table if not exists public.budget_state (
  id int primary key default 1,
  -- True when spend has breached a threshold and paid providers are cut off.
  tripped boolean not null default false,
  -- "daily" | "monthly" | "manual" — what tripped it, null when not tripped.
  reason text,
  -- Spend and threshold at the moment it tripped, for the admin panel + email.
  spend_usd numeric(12, 6),
  threshold_usd numeric(12, 6),
  tripped_at timestamptz,
  -- Set when an admin clears the flag from the Health tab.
  cleared_at timestamptz,
  cleared_by text,
  updated_at timestamptz not null default now(),
  -- Enforces the single row: any second insert collides on this check.
  constraint budget_state_singleton check (id = 1)
);

comment on table public.budget_state is
  'Single-row budget-guard kill flag (E-5). Read by lib/budget-guard.ts, written by /api/cron/budget-guard and the admin re-enable button.';

insert into public.budget_state (id) values (1) on conflict (id) do nothing;

alter table public.budget_state enable row level security;
revoke all on table public.budget_state from anon, authenticated;
