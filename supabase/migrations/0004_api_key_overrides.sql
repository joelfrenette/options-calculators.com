-- 0004_api_key_overrides.sql — admin-managed API keys (AUDIT_BACKLOG P4-4)
--
-- Lets the owner paste or rotate a provider key from the admin instead of
-- editing a Vercel environment variable and redeploying. Values are encrypted
-- at rest with AES-256-GCM; see lib/key-store.ts.
--
-- WHAT IS AND IS NOT STORED. `value_encrypted` is ciphertext — the plaintext
-- key never touches this table, the logs, or any API response. `last4` exists
-- solely so the admin UI can show "····3f9a" and let the owner confirm WHICH
-- key is set without ever being able to read it back. A key you can retrieve
-- through the UI is a key that leaks the moment the admin session does, so the
-- read path deliberately has no way to return one.
--
-- PRECEDENCE. An override here beats the environment variable, and the admin
-- says so. Both are still beaten by DISABLED_APIS and by the budget guard —
-- pasting a key must never defeat a kill switch.

create table if not exists public.api_key_overrides (
  -- Canonical key name from API_KEY_ALIASES in lib/api-keys.ts.
  name text primary key,
  -- "v1:<ivHex>:<authTagHex>:<cipherHex>" — see lib/key-store.ts.
  value_encrypted text not null,
  -- Last 4 characters of the plaintext, for display only.
  last4 text,
  updated_at timestamptz not null default now(),
  -- Who set it. Single-admin today, so this is "admin"; kept as text so it
  -- still means something if auth ever moves to a real user store.
  updated_by text
);

comment on table public.api_key_overrides is
  'Admin-pasted API keys, AES-256-GCM encrypted (P4-4). Overrides the matching env var. Read only by server code holding the service role; values are never returned through any API.';
comment on column public.api_key_overrides.value_encrypted is
  'Ciphertext only. Decrypted in lib/key-store.ts with a key derived from ENCRYPTION_KEY.';
comment on column public.api_key_overrides.last4 is
  'Last 4 plaintext characters, for display. Enough to identify a key, useless for using one.';

-- Service-role-only, same posture as api_calls / budget_state / login_attempts:
-- RLS enabled with NO policies, so anon and authenticated can do nothing, and
-- the grants are revoked as well.
alter table public.api_key_overrides enable row level security;
revoke all on table public.api_key_overrides from anon, authenticated;
