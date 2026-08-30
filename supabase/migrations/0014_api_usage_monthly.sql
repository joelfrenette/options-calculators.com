-- 0014_api_usage_monthly.sql — per-month, per-provider usage rollup
--
-- WHY: the Costs tab showed measured usage only as an all-time in-memory
-- snapshot plus the daily rollup (0001's api_calls_daily). The admin audit
-- (2026-08-29, section D) asked for a durable MONTHLY per-provider total so the
-- measured call volume sits beside the flat-fee subscription figure — one page
-- answering "what did each provider actually cost / do this month".
--
-- Spans ALL providers from the single api_calls table: the data providers
-- (Apify, Alpha Vantage, FMP, Serper, ScrapingBee, FRED) are metered as of the
-- 2026-08-29 metering pass, so they now appear here with cost_usd 0 (flat-rate,
-- no per-call marginal cost); the pay-per-use LLM rows carry the priced spend
-- and the unpriced-call count, exactly as api_spend_daily reports it.

create or replace view public.api_usage_monthly
with (security_invoker = on) as
select
  date_trunc('month', ts)::date as month,
  provider,
  count(*)::int as calls,
  coalesce(sum(cost_usd) filter (where cost_known is true), 0)::numeric(12, 6) as cost_usd,
  (count(*) filter (where cost_known is false))::int as unpriced_calls
from public.api_calls
group by 1, 2
order by 1 desc, 2;

comment on view public.api_usage_monthly is
  'Per-month, per-provider rollup of api_calls: call count, priced USD (LLM only), unpriced call count. Feeds the Costs tab "Monthly by provider" table.';

-- security_invoker (above) means the view offers no way around api_calls'
-- RLS; belt-and-braces, revoke from the client roles as the other views do.
revoke all on public.api_usage_monthly from anon, authenticated;
