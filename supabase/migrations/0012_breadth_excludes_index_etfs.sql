-- 0012 — breadth must exclude the index ETFs, and report a measured universe
--
-- FOUND 2026-08-10 by a 5-year closes backfill. The daily run had reported
-- "99/100 qualified" for months; immediately after the backfill it reported
-- "102/100 qualified" — more constituents than the universe contains, which is
-- incoherent on its face.
--
-- Two defects, both invisible until history arrived.
--
-- 1. NEITHER function filtered by ticker. market_closes holds SPY and QQQ
--    alongside the ~100 constituents (added in E-7c at zero API cost for the
--    VIX/price paths). Before the backfill those two had no 200-day history so
--    they never qualified, and the omission could not be seen. With five years
--    loaded they qualify, and breadth silently became a 102-name measure.
--
--    This is worse than a miscount. SPY and QQQ ARE the index. Including them
--    in "what share of members hold above their own 200-day trend" is circular,
--    and it biases breadth upward precisely when breadth matters — an index
--    holding up while its members roll over is the exact divergence the
--    CCPI redesign wants to detect (CCPI_DESIGN.md §5).
--
-- 2. universe_size was the CALLER'S PARAMETER, not a measurement. It always
--    said 100 regardless of what was actually there, so the one field that
--    could have revealed defect 1 was hardcoded to hide it.
--
-- Both functions now exclude the ETF set and report universe_size as the
-- measured count of distinct eligible tickers. sample_size remains the number
-- with a full 200-day window — legitimately smaller, and now legitimately
-- comparable to the denominator beside it.

create or replace function public.compute_breadth(universe_n integer default 100)
returns table(day date, pct numeric, sample_size integer, universe_size integer)
language sql
security definer
set search_path to 'public'
as $function$
  with eligible as (
    select * from market_closes where ticker not in ('SPY', 'QQQ')
  ),
  ranked as (
    select ticker, close, mc.day,
           row_number() over (partition by ticker order by mc.day desc) as rn
    from eligible mc
  ),
  agg as (
    select ticker,
           max(close) filter (where rn = 1) as latest_close,
           avg(close) filter (where rn <= 200) as sma200,
           count(*) filter (where rn <= 200) as n
    from ranked
    group by ticker
  ),
  qualified as (
    select * from agg where n >= 200
  ),
  result as (
    insert into breadth_daily (day, pct_above_200dma, sample_size, universe_size)
    select
      (select max(mc.day) from eligible mc),
      round(100.0 * count(*) filter (where latest_close > sma200) / count(*), 2),
      count(*)::int,
      (select count(distinct ticker)::int from eligible)
    from qualified
    having count(*) > 0
    on conflict (day) do update
      set pct_above_200dma = excluded.pct_above_200dma,
          sample_size = excluded.sample_size,
          universe_size = excluded.universe_size,
          computed_at = now()
    returning breadth_daily.day, breadth_daily.pct_above_200dma, breadth_daily.sample_size, breadth_daily.universe_size
  )
  select * from result;
$function$;

create or replace function public.compute_breadth_range(universe_n integer default 100, from_day date default null, to_day date default null)
returns table(day date, pct numeric, sample_size integer, universe_size integer)
language sql
security definer
set search_path to 'public'
as $function$
  with eligible as (
    select * from market_closes where ticker not in ('SPY', 'QQQ')
  ),
  bounds as (
    select
      coalesce(from_day, (select min(mc.day) from eligible mc)) as lo,
      coalesce(to_day,   (select max(mc.day) from eligible mc)) as hi
  ),
  windowed as (
    select mc.ticker, mc.day, mc.close,
           avg(mc.close) over w as sma200,
           count(*)      over w as n
    from eligible mc
    window w as (
      partition by mc.ticker
      order by mc.day
      rows between 199 preceding and current row
    )
  ),
  qualified as (
    select * from windowed, bounds
    where n >= 200 and windowed.day between bounds.lo and bounds.hi
  ),
  per_day as (
    select qualified.day,
           round(100.0 * count(*) filter (where close > sma200) / count(*), 2) as pct,
           count(*)::int as sample_size
    from qualified
    group by qualified.day
    having count(*) > 0
  ),
  result as (
    insert into breadth_daily (day, pct_above_200dma, sample_size, universe_size)
    select per_day.day, per_day.pct, per_day.sample_size,
           (select count(distinct ticker)::int from eligible)
    from per_day
    on conflict (day) do update
      set pct_above_200dma = excluded.pct_above_200dma,
          sample_size      = excluded.sample_size,
          universe_size    = excluded.universe_size,
          computed_at      = now()
    returning breadth_daily.day, breadth_daily.pct_above_200dma, breadth_daily.sample_size, breadth_daily.universe_size
  )
  select * from result order by 1;
$function$;

comment on function public.compute_breadth(integer) is
  'Breadth: share of universe constituents above their 200-day SMA. Excludes SPY/QQQ — they are the index, and counting them is circular (migration 0012).';
comment on function public.compute_breadth_range(integer, date, date) is
  'Trailing-window breadth over a date range. Excludes SPY/QQQ; universe_size is measured, not the caller parameter (migration 0012).';
