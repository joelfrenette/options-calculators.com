-- Research Queue Phase 3: the morning recap (RESEARCH_QUEUE_DESIGN.md §Phase 3).
--
-- One row per owner holding the latest "what changed overnight" digest, written
-- by the nightly /api/cron/research-refresh job and read by the Research tab.
-- Deterministic deltas (strategy flips, CSP/LEAPS band moves, price-drop
-- triggers) are computed from each queued row's recommendation vs
-- prev_recommendation; `summary` is an Opus 5 narration over those deltas, or
-- the deterministic sentence when the model is unavailable (`is_llm` says which).
--
-- RLS deny-all + service key, the house pattern — every access is server-side.

create table if not exists research_recap (
  owner_email  text primary key,
  generated_at timestamptz not null default now(),
  summary      text,
  items        jsonb not null default '[]'::jsonb,
  is_llm       boolean not null default false
);

alter table research_recap enable row level security;
-- No policies: deny-all to anon/authenticated; the service role bypasses RLS.
