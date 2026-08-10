-- 0011 — retention 1100 -> 9000 days (CCPI_DESIGN.md Phase 1, decision 2)
--
-- WHY. Migration 0010 raised this 400 -> 1100 and said so in its own comment:
-- "THIS DOES NOT MAKE 2000 OR 2008 TESTABLE. Three years of history reaches the
-- 2022 episode and nothing earlier." That was the right call at the time. The
-- CCPI redesign now requires exactly what it ruled out.
--
-- The approved design (CCPI_DESIGN.md §6) scores every candidate indicator by
-- its measured lead time against four reference drawdowns — 2000-03, 2007-09,
-- 2020-02 and 2022-01 — plus the >=10% corrections in between. 1100 days
-- reaches only the last of the four. Until this changes, the backtest is
-- GUARANTEED to answer `insufficient-history`, which is precisely what
-- lib/breadth-backtest.ts correctly did in E-7e. This is the blocking change
-- for the whole redesign, and it is a one-line default.
--
-- 9000 days ~ 24.6 years, reaching 2001. Note honestly what that does and does
-- not buy: it covers 2008, 2020 and 2022 in full and the TAIL of the 2000-03
-- bear market, not its top. The 2000 top needs ~9600 days; the constraint there
-- is not this number but the ticker universe, which is a 2026 list and does not
-- contain the companies that fell hardest in 2000 (recorded in AUDIT_BACKLOG
-- E-6). Price-based signals therefore remain untestable against 2000 whatever
-- the retention. The FRED-sourced macro and credit series in market_series are
-- unaffected by this table's retention and can be backfilled to 1990 — which is
-- why the design leans on them first.
--
-- Storage: ~102 tickers x ~6200 trading days ~ 630k rows, up from ~77k. Still
-- small for the existing plan, but an order of magnitude more than before, so
-- it is a deliberate decision rather than a tweak.
--
-- The zero-arg overload was already dropped in 0010. Dropping the int form
-- before recreating keeps that discipline: `create or replace` with a changed
-- default silently leaves callers on whichever signature they resolved to.

drop function if exists public.prune_market_closes(int);

create or replace function public.prune_market_closes(retain_days int default 9000)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.market_closes where day < now() - (retain_days || ' days')::interval;
$$;

revoke all on function public.prune_market_closes(int) from anon, authenticated;

comment on function public.prune_market_closes(int) is
  'Retention for market_closes. Default raised 1100 -> 9000 days (~24.6y) for the CCPI lead-time backtest (CCPI_DESIGN.md Phase 1). 1100 reached only the 2022 drawdown; the redesign scores indicators against 2000/2008/2020/2022.';
