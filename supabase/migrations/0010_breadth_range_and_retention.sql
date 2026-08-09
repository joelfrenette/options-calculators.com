-- 0010_breadth_range_and_retention.sql — per-day historical breadth (E-7e)
--
-- WHY: compute_breadth() (migration 0006) writes exactly ONE row — the latest
-- stored day. That is right for the daily cron and useless for a backtest:
-- the lead-time harness needs a SERIES, and 400 days of stored closes already
-- contain ~200 computable days that were simply never computed.
--
-- compute_breadth_range() walks every day that has a full 200-day lookback
-- and upserts the lot. It is a one-off (or occasional) call, not part of the
-- daily path, so it stays a separate function rather than making the cron
-- pay for a full-history window pass every evening.

create or replace function public.compute_breadth_range(
  universe_n int default 100,
  from_day date default null,
  to_day date default null
)
returns table(day date, pct numeric, sample_size int, universe_size int)
language sql
security definer
set search_path = public
as $$
  with bounds as (
    select
      coalesce(from_day, (select min(mc.day) from market_closes mc)) as lo,
      coalesce(to_day,   (select max(mc.day) from market_closes mc)) as hi
  ),
  -- Every (ticker, day) with its trailing 200-day average and the count of
  -- observations that average is actually built from. ROWS BETWEEN is the
  -- whole point: the average for a given day uses only days up to it, so the
  -- series is computed as it would have been seen at the time. Averaging the
  -- full history into every row would be lookahead bias.
  windowed as (
    select
      mc.ticker,
      mc.day,
      mc.close,
      avg(mc.close) over w  as sma200,
      count(*)      over w  as n
    from market_closes mc
    window w as (
      partition by mc.ticker
      order by mc.day
      rows between 199 preceding and current row
    )
  ),
  -- A ticker votes on a day only with a FULL 200-close lookback. Partial
  -- histories do not vote — same rule as compute_breadth(), and the reason a
  -- warming-up store reports a small sample rather than a flattering number.
  qualified as (
    select * from windowed, bounds
    where n >= 200 and windowed.day between bounds.lo and bounds.hi
  ),
  per_day as (
    select
      qualified.day,
      round(100.0 * count(*) filter (where close > sma200) / count(*), 2) as pct,
      count(*)::int as sample_size
    from qualified
    group by qualified.day
    having count(*) > 0
  ),
  result as (
    insert into breadth_daily (day, pct_above_200dma, sample_size, universe_size)
    select per_day.day, per_day.pct, per_day.sample_size, universe_n from per_day
    on conflict (day) do update
      set pct_above_200dma = excluded.pct_above_200dma,
          sample_size      = excluded.sample_size,
          universe_size    = excluded.universe_size,
          computed_at      = now()
    returning breadth_daily.day, breadth_daily.pct_above_200dma, breadth_daily.sample_size, breadth_daily.universe_size
  )
  select * from result order by 1;
$$;

revoke all on function public.compute_breadth_range(int, date, date) from anon, authenticated;

comment on function public.compute_breadth_range(int, date, date) is
  'E-7e: breadth for EVERY stored day with a full 200-close lookback, trailing-window so no day sees the future. One-off/occasional; the daily cron keeps using compute_breadth().';

-- ---------------------------------------------------------------------------
-- RETENTION CONFLICT — read before running a deep backfill.
--
-- prune_market_closes() (migration 0005) deletes closes older than 400 days.
-- That was correct when the only consumer was a 200-DMA, and it silently
-- destroys any deeper history a backtest backfill loads: the next daily cron
-- run would delete exactly what was just paid for.
--
-- The window is now a named constant so the two facts cannot drift apart:
-- 1100 days ≈ 3 years, which is 200 days of warm-up plus ~2.5 years of
-- computable breadth. Storage cost at ~102 tickers is roughly 102 × 750
-- trading days ≈ 77k rows — well inside the existing $10/mo Supabase plan and
-- the same order as the 32,858 rows already stored.
--
-- NOTE THIS DOES NOT MAKE 2000 OR 2008 TESTABLE. Three years of history
-- reaches the 2022 episode and nothing earlier, and the 2026 universe cannot
-- honestly be run against those decades regardless (survivorship — the
-- constituents that fell hardest were deleted from the index and are absent
-- from the list). lib/breadth-backtest.ts reports those episodes as
-- `covered: false` rather than inventing a lead time for them.
-- ---------------------------------------------------------------------------

-- Drop the zero-arg version first. `create or replace` with a new signature
-- ADDS an overload rather than replacing, and a no-argument call from the cron
-- would keep resolving to the old 400-day function — the deep history would
-- still be deleted, silently, while this migration looked applied.
drop function if exists public.prune_market_closes();

create or replace function public.prune_market_closes(retain_days int default 1100)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.market_closes where day < now() - (retain_days || ' days')::interval;
$$;

revoke all on function public.prune_market_closes(int) from anon, authenticated;

comment on function public.prune_market_closes(int) is
  'Retention for market_closes. Default raised 400 -> 1100 days (E-7e): 400 deleted the deeper history a lead-time backtest needs on the very next cron run.';
