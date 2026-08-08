-- 0007_ai_estimates.sql — TTL cache for AI-estimated indicators (E-7a)
--
-- WHY: the unified AI fallback (CAPE, Mag7 concentration, QQQ P/E, short
-- interest, ISM, ...) ran its LLM chain on EVERY CCPI request. These values
-- move daily at most; per-view estimation was the site's largest recurring
-- LLM spend and its slowest CCPI path. One fresh estimate per indicator per
-- TTL window serves every request in between.
--
-- HONESTY: only LIVE estimates are cached — a baseline fallback is never
-- written, so a cached row is always a real model answer. The original
-- source ("grok"/"groq"/...) is stored unchanged, so tier attribution
-- (ai-estimate) is identical whether the value came fresh or from cache;
-- updated_at lets the UI show age.

create table if not exists public.ai_estimates (
  key text primary key,
  value numeric(16, 6) not null,
  source text not null,
  updated_at timestamptz not null default now()
);

comment on table public.ai_estimates is
  'TTL cache for lib/unified-ai-fallback.ts estimates (E-7a). Live model answers only — baselines are never cached. Source preserved for tier attribution.';

alter table public.ai_estimates enable row level security;
revoke all on table public.ai_estimates from anon, authenticated;
