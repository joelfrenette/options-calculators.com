-- 0016 — observed AI provider liveness, from the ledger the app already writes.
--
-- WHY. The admin AI tab answers "does a key resolve for this provider" and says
-- so plainly (`measurement: "key presence only"`). That is honest, and it is not
-- the question a reader is asking. Between 2026-08-08 and 2026-08-30 xAI failed
-- 401 times out of 401 while the panel showed it configured and first in the
-- chain, because a resolvable key and a working provider are different facts and
-- only one of them was on screen.
--
-- This view supplies the other one WITHOUT calling any vendor: every number here
-- comes from rows the app already wrote. A liveness probe would spend tokens on
-- every admin page load, which is why the route makes zero upstream calls and
-- must keep making zero.
--
-- Scope: AI calls only (`model is not null`), trailing 7 days. Plain data-provider
-- fetches have their own surfaces on the Costs tab.

create or replace view public.api_provider_health as
with recent as (
  select provider, ok, error_class, ts
  from public.api_calls
  where ts >= now() - interval '7 days'
    and model is not null
),
agg as (
  select
    provider,
    count(*)                                as calls,
    count(*) filter (where ok)              as ok_calls,
    count(*) filter (where not ok)          as failed_calls,
    max(ts)  filter (where ok)              as last_ok,
    max(ts)  filter (where not ok)          as last_failure
  from recent
  group by provider
),
-- The dominant failure cause, so the panel can say WHICH fix is needed rather
-- than only that something is wrong. NULL for rows written before migration
-- 0015, which carry no cause — never substitute a guess for that.
top_err as (
  select distinct on (provider) provider, error_class
  from (
    select provider, error_class, count(*) as n
    from recent
    where error_class is not null
    group by provider, error_class
  ) t
  order by provider, n desc, error_class
)
select
  a.provider,
  a.calls,
  a.ok_calls,
  a.failed_calls,
  a.last_ok,
  a.last_failure,
  e.error_class as top_error_class
from agg a
left join top_err e using (provider);

comment on view public.api_provider_health is
  'Observed AI provider liveness over the trailing 7 days, derived from api_calls — no vendor is contacted to produce it. Answers "does this provider actually work", which key-presence cannot. top_error_class is NULL for providers whose failures predate migration 0015 (no cause on file) — that is "not recorded", never "fine".';
