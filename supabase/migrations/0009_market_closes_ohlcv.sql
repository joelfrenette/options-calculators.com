-- 0009_market_closes_ohlcv.sql — high/low/volume on market_closes (E-7c part 2)
--
-- WHY: /api/trend-analysis still pulls Yahoo per page view for SPY, ^SPX and
-- QQQ — the flaky dependency E-7c exists to remove. It could not move to the
-- store because market_closes holds the CLOSE only, while that route computes
-- ATR from highs and lows and reports volume against a 10-day average.
-- Swapping to close-only data would have silently dropped ATR and the volume
-- signals, which is precisely the quiet degradation this audit removes.
--
-- COST: none. The Polygon grouped-daily bar the snapshot already fetches
-- carries h/l/v alongside c — they were simply being discarded. No extra API
-- call, no new service.
--
-- NULLABLE ON PURPOSE: every row written before this migration has no OHLC,
-- and backfilling history is a separate one-off run. Readers must treat a
-- null high/low/volume as "this bar predates OHLCV capture" and fall back to
-- the live source rather than substituting the close for the missing legs —
-- a bar whose high and low both equal the close is a fabricated zero-range
-- day, and ATR would read it as calm.

alter table public.market_closes
  add column if not exists high numeric(14, 4),
  add column if not exists low numeric(14, 4),
  add column if not exists volume bigint;

comment on column public.market_closes.high is
  'Session high from the Polygon grouped-daily bar. NULL for rows written before migration 0009 — readers fall back to the live source, never to the close.';
comment on column public.market_closes.low is
  'Session low. NULL for pre-0009 rows; see the high column comment.';
comment on column public.market_closes.volume is
  'Session share volume. NULL for pre-0009 rows; see the high column comment.';

-- Breadth is unaffected: compute_breadth() reads close only, and the chart
-- proxies (SPY, QQQ) are excluded from its denominator by universe_n.
