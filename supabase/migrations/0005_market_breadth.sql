-- 0005_market_breadth.sql — breadth: % of universe above its 200-DMA (E-6a)
--
-- WHY: breadth narrowing while the index makes highs is one of the few
-- indicators with documented LEAD time on major drawdowns — the "fewer
-- soldiers following the generals" divergence. CCPI tracked only QQQ
-- index-level technicals; the market-breadth route was retired in P5b for
-- fabricating data. This is its honest replacement: real closes, stored
-- daily, 200-DMA computed from actual history.
--
-- FEED: /api/cron/breadth (daily) pulls ONE Polygon grouped-daily call and
-- upserts closes for the tracked universe (lib/breadth-universe.ts). Breadth
-- for a day is computed only from tickers with a full 200 closes on record —
-- no partial-history fakery. Until backfill completes the API reports
-- "warming up" with the honest sample count.
--
-- SCORING: none. Per the E-6 design constraint the indicator earns CCPI
-- weight only after a lead-time backtest vs the 2000/2008/2020/2022 drawdown
-- starts. Until then it is display + canary only.

create table if not exists public.market_closes (
  ticker text not null,
  day date not null,
  close numeric(14, 4) not null,
  primary key (ticker, day)
);

comment on table public.market_closes is
  'Daily closes for the breadth universe (lib/breadth-universe.ts), written by /api/cron/breadth from Polygon grouped-daily bars.';

create index if not exists market_closes_day_idx on public.market_closes (day desc);

create table if not exists public.breadth_daily (
  day date primary key,
  -- % of qualified universe tickers whose close is above their own 200-DMA.
  pct_above_200dma numeric(5, 2) not null,
  -- Tickers with a full 200-day history that day (the divisor). If this is
  -- well below the universe size, the reading is thin and the API says so.
  sample_size int not null,
  universe_size int not null,
  computed_at timestamptz not null default now()
);

comment on table public.breadth_daily is
  'Computed breadth series (E-6a): % of universe above 200-DMA. sample_size < universe_size means partial history — surfaced, never hidden.';

alter table public.market_closes enable row level security;
alter table public.breadth_daily enable row level security;
revoke all on table public.market_closes from anon, authenticated;
revoke all on table public.breadth_daily from anon, authenticated;

-- Retention: closes only need ~1.5y for a 200-DMA plus buffer.
create or replace function public.prune_market_closes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.market_closes where day < now() - interval '400 days';
$$;

revoke all on function public.prune_market_closes() from anon, authenticated;
