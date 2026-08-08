-- 0006_breadth_compute_rpc.sql — server-side breadth compute (E-6a fix)
--
-- WHY: the cron route's first compute read closes back through PostgREST and
-- aggregated in JS. PostgREST caps responses at 1000 rows — ~10 days of a
-- 100-ticker universe — so no ticker ever showed 200 days of history and the
-- compute reported "keep backfilling" against a store holding 32,858 closes.
-- One SQL window pass has no row cap and is where this aggregation belongs.

create or replace function public.compute_breadth(universe_n int default 100)
returns table(day date, pct numeric, sample_size int, universe_size int)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select ticker, close, mc.day,
           row_number() over (partition by ticker order by mc.day desc) as rn
    from market_closes mc
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
    -- Full 200-day history required — partial histories do not vote.
    select * from agg where n >= 200
  ),
  result as (
    insert into breadth_daily (day, pct_above_200dma, sample_size, universe_size)
    select
      (select max(mc.day) from market_closes mc),
      round(100.0 * count(*) filter (where latest_close > sma200) / count(*), 2),
      count(*)::int,
      universe_n
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
$$;

revoke all on function public.compute_breadth(int) from anon, authenticated;
