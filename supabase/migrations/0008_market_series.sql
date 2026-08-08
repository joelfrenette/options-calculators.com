-- 0008_market_series.sql — generic named daily-series store (E-8a, reused by E-7b)
--
-- One row per (series, day). First tenant: 'offexchange_short_pct' — the
-- aggregate FINRA off-exchange short-volume ratio from Quiver, replacing the
-- Panic/Euphoria "NYSE Short Interest" VIX-proxy with measured data (P6-8).
-- Percentile-of-own-history normalization needs history; the store is what
-- accumulates it. E-7b's FRED series land here too instead of a new table
-- per source.

create table if not exists public.market_series (
  series text not null,
  day date not null,
  value numeric(16, 6) not null,
  primary key (series, day)
);

comment on table public.market_series is
  'Generic named daily series (E-8a/E-7b): offexchange_short_pct from Quiver, FRED series, etc. Written by API routes/crons; percentile-normalized by readers.';

create index if not exists market_series_series_day_idx on public.market_series (series, day desc);

alter table public.market_series enable row level security;
revoke all on table public.market_series from anon, authenticated;
