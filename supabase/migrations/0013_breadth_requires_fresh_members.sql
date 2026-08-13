-- P7-55. compute_breadth counted a delisted member on a seven-month-old price.
--
-- Applied to production 2026-08-13 as `20260813164047` on the owner's explicit
-- authorisation. Recorded here under 0013 because the repo already had a 0012;
-- the applied migration carries the name `0012_compute_breadth_requires_fresh_
-- members`, and that mismatch is noted rather than silently renumbered, because
-- the applied name is what `list_migrations` will show forever.
--
-- THE DEFECT. The function ranked
--   row_number() over (partition by ticker order by day desc)
-- and qualified any ticker whose last 200 rows numbered 200 -- WITH NO DATE
-- CONSTRAINT AT ALL. MMC (delisted, Polygon 404 since 2026-01-13, 1,111 stored
-- rows ending that day) therefore qualified on every run:
--
--   ticker  latest_day    latest_close   its own sma200   counts as
--   AAPL    2026-08-13    303.46         280.29           above
--   MMC     2026-01-13    182.70         205.44           BELOW
--
-- A delisted stock, priced seven months ago, voting "below its 200-day average"
-- in a reading published for August -- every day, in one direction, forever, and
-- drifting further as the stale price ages away from the market.
--
-- WHY NOBODY SAW IT. It produced a plausible number, and the SIBLING function
-- was correct: compute_breadth_range windows properly by date, so the
-- historical series read sample_size 99 while the daily row read 100. **Two
-- definitions of one number, on one table, disagreeing by exactly one member**,
-- and the disagreement was visible in the same API response the whole time.
--
-- It also survived P6-27's fix earlier the same day. Removing MMC from
-- `lib/breadth-universe.ts` did nothing here, because this function derives its
-- universe from `count(distinct ticker) from market_closes`, not from the
-- constant. **Fixing the list a number is supposed to come from is not the same
-- as fixing where the number comes from.**
--
-- TWO CONDITIONS, and the second is deliberately a no-op today:
--   1. FRESHNESS -- the ticker's latest row must be within 6 days of the latest
--      trading day in the table. The same rule lib/market-closes.ts already
--      applies before it will serve stored closes at all.
--   2. SPAN -- the 200 rows must fall within 400 calendar days. Excludes nobody
--      right now (99 with it, 99 without, measured before applying). It guards
--      what freshness alone cannot: a ticker that goes dark for months and
--      RESUMES is fresh, but its "last 200 rows" straddle the gap and its
--      200-day average would silently span two different eras.
--
-- universe_size now reports the qualified set rather than every ticker ever
-- stored -- counting rows in the table is how a delisted member stayed in the
-- denominator after it had stopped being in the universe.
--
-- Signature unchanged, so this replaces rather than adding an overload -- the
-- trap migration 0010 had to drop an old signature to avoid.
--
-- Verified on production immediately after applying:
--   before  {"pctAbove200DMA":69,   "sampleSize":100,"universeSize":100}
--   after   {"pctAbove200DMA":69.7, "sampleSize":99, "universeSize":99}
-- and the daily row now agrees with the historical series, which had read 99
-- on every prior day.
create or replace function public.compute_breadth(universe_n integer default 100)
returns table(day date, pct numeric, sample_size integer, universe_size integer)
language sql
security definer
set search_path to 'public'
as $function$
  with eligible as (
    select * from market_closes where ticker not in ('SPY', 'QQQ')
  ),
  latest as (
    select max(mc.day) as d from eligible mc
  ),
  ranked as (
    select ticker, close, mc.day,
           row_number() over (partition by ticker order by mc.day desc) as rn
    from eligible mc
  ),
  agg as (
    select ticker,
           max(close) filter (where rn = 1) as latest_close,
           max(day)   filter (where rn = 1) as latest_day,
           min(day)   filter (where rn <= 200) as oldest_of_200,
           avg(close) filter (where rn <= 200) as sma200,
           count(*)   filter (where rn <= 200) as n
    from ranked
    group by ticker
  ),
  qualified as (
    select a.* from agg a, latest l
    where a.n >= 200
      and a.latest_day >= l.d - 6
      and a.oldest_of_200 >= l.d - 400
  ),
  result as (
    insert into breadth_daily (day, pct_above_200dma, sample_size, universe_size)
    select
      (select d from latest),
      round(100.0 * count(*) filter (where latest_close > sma200) / count(*), 2),
      count(*)::int,
      count(*)::int
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
