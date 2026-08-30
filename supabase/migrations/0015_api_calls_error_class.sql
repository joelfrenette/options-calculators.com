-- 0015 — record WHY an AI call failed, not just that it did.
--
-- Until now a failed LLM call wrote `ok = false` and nothing else. `status` was
-- hardcoded to 0 on the failure path in recordAiCall, so the upstream status the
-- SDK error already carried never reached the row.
--
-- The cost of that: xAI failed 401 times out of 401 between 2026-08-08 and
-- 2026-08-30 — a 100% failure rate on the FIRST provider of all six CCPI
-- fallback chains, feeding the site's default landing page — and the ledger
-- could not say whether the key was dead, the quota was spent, or the model slug
-- had been retired. The failures were durably recorded and completely
-- unreadable. It was investigated for three weeks as a token-accounting bug,
-- because unpriced rows are what you see when you cannot see the cause.
--
-- Two nullable columns, no backfill: rows written before this migration have no
-- cause on file and must read NULL rather than be assigned a guessed one. NULL
-- here means "not recorded", which is exactly the house rule — missing data is
-- null, never an invented constant.

alter table public.api_calls
  add column if not exists error_class  text,
  add column if not exists error_detail text;

comment on column public.api_calls.error_class is
  'Cause class for a failed AI call: model_not_found | auth | rate_limit | bad_request | upstream | timeout | transport | unknown. NULL on success, on plain (non-AI) fetches, and on rows written before migration 0015. See lib/ai-error-class.ts — the classes are chosen to separate causes that need DIFFERENT fixes (change the slug vs rotate the key vs back off).';

comment on column public.api_calls.error_detail is
  'Short truncated (<=300 char) message behind error_class. Never the full response body. NULL on success and on pre-0015 rows.';

-- Partial index: failure triage always filters to failures, and failures are a
-- small minority of the table. Indexing only them keeps the index small and
-- keeps the hot success-path insert cheap.
create index if not exists api_calls_error_class_idx
  on public.api_calls (error_class, ts desc)
  where error_class is not null;
