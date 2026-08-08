# API Key Management

> **Corrected 2026-08-07.** The previous version of this file described, in
> detail and with confidence, a system that does not exist: AES-256-GCM encryption, a
> `.api-keys.encrypted` store, an "API Keys Management" screen with input fields
> and a **Save All API Keys** button, key backup/restore, and a `getApiKey()`
> that falls back to encrypted storage. None of it is in the repo — there is no
> `createCipheriv` call anywhere, no `.api-keys.encrypted` handling, and
> `/api/admin/api-keys` has no POST handler. `ENCRYPTION_KEY` is declared in
> `lib/api-keys.ts` and never read.
>
> The document also carried a "Migration from Environment Variables" procedure
> ending in *"Remove from .env"* — following it would have deleted every key with
> nothing to fall back to.
>
> Documentation that describes features the code does not have is the same
> failure mode as data the code invents, and it is corrected here on the same
> principle. Admin-managed keys are tracked as a real feature request in
> AUDIT_BACKLOG **P4-4**.

## How keys actually work

**API keys come from environment variables. There is no other store.**

- Set them in Vercel → project → Settings → Environment Variables.
- Environment variable changes take effect **only on a new build** — redeploy after adding one.
- `lib/api-keys.ts` `resolveApiKey(name)` is the single resolution point. It
  checks each accepted spelling for that key in order, and returns `""` when the
  service is unconfigured, kill-switched via `DISABLED_APIS`, or cut off by the
  budget guard.
- Never read `process.env.SOMETHING_API_KEY` directly. Doing so bypasses
  `DISABLED_APIS`, the budget guard, and the alias list. Five libraries used to
  do exactly that; see AUDIT_BACKLOG E-5b.

```typescript
import { resolveApiKey } from "@/lib/api-keys"

const apiKey = resolveApiKey("POLYGON_API_KEY") // "" when unavailable
```

### The admin "API Keys" panel is read-only

`components/api-keys-manager.tsx` shows, per service, whether a key is
**Configured**, **Kill-switched** (present but disabled via `DISABLED_APIS`), or
**Not set**. It has no input fields and saves nothing — it reads
`/api/admin/api-keys` and `/api/admin/usage` and renders status. That is by
design and the panel says so.

### Key aliases

Several services accept more than one spelling, because the codebase historically
referenced them inconsistently. `API_KEY_ALIASES` in `lib/api-keys.ts` is the
source of truth; prefer the canonical (first) name.

| Canonical | Also accepted |
|---|---|
| `TWELVE_DATA_API_KEY` | `TWELVEDATA_API_KEY` |
| `APIFY_API_TOKEN` | `APIFY_API_KEY` |
| `XAI_API_KEY` | `GROK_XAI_API_KEY` |
| `GOOGLE_AI_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` |

## The keys

Status reflects the cost-optimization decisions in `lib/api-costs.ts`.

| Key | Provider | Status | Purpose |
|---|---|---|---|
| `POLYGON_API_KEY` | [polygon.io](https://polygon.io/) | keep-paid, $29/mo | Live options chains, Greeks, quotes, OHLCV — powers the scanners |
| `FRED_API_KEY` | [FRED](https://research.stlouisfed.org/useraccount/apikeys) | keep-free | Fed Funds, CPI, VIX, yield curve, jobs, credit spreads |
| `FINNHUB_API_KEY` | [finnhub.io](https://finnhub.io/) | keep-free | Earnings, insider transactions, news |
| `FMP_API_KEY` | [FMP](https://financialmodelingprep.com/) | downgrade to free | Fundamentals, valuation ratios |
| `ALPHA_VANTAGE_API_KEY` | [Alpha Vantage](https://www.alphavantage.co/) | eliminate | Redundant with FRED + local calc |
| `TWELVE_DATA_API_KEY` | [twelvedata.com](https://twelvedata.com/) | eliminate | Replaced by local calc from Polygon OHLCV |
| `APIFY_API_TOKEN` | [apify.com](https://apify.com/) | eliminate | Replaced by FMP/Finnhub free |
| `SCRAPINGBEE_API_KEY` | [scrapingbee.com](https://www.scrapingbee.com/) | eliminate | Replaced by CNN direct + Alternative.me |
| `SERPER_API_KEY` | [serper.dev](https://serper.dev/) | **keep-free** | Google search/news — `/api/google-trends`, `/api/serper-finance` |
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com/) | eliminate | No call site in the repo at all |
| `RESEND_API_KEY` | [resend.com](https://resend.com/) | keep-free | Budget-guard shutoff notifications |
| `GROQ_API_KEY` | [groq.com](https://groq.com/) | keep-free | AI fallback chain |
| `GOOGLE_AI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) | keep-free | AI fallback chain |
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai/) | pay-per-use | Primary AI (free model), guarded |
| `OPENAI_API_KEY` | [openai.com](https://platform.openai.com/) | pay-per-use | AI fallback, guarded |
| `ANTHROPIC_API_KEY` | [anthropic.com](https://console.anthropic.com/) | pay-per-use | AI fallback, guarded |
| `XAI_API_KEY` | [x.ai](https://x.ai/) | pay-per-use | AI fallback, guarded |
| `PERPLEXITY_API_KEY` | [perplexity.ai](https://www.perplexity.ai/) | pay-per-use | Search-augmented AI fallback, guarded |

A key marked `eliminate` being absent is **expected**, not a fault. The health
check reports those routes as `blocked` — "no credential to call its provider
with" — rather than as failures.

## Troubleshooting

**A route reports "Key(s) not configured".** The key is missing for that
environment. A Production-only variable leaves staging blocked, and vice versa —
set both, then redeploy.

**A key is set but the service still does not work.** Check whether it is
kill-switched: `DISABLED_APIS` (manual) or the budget guard (automatic). The
admin API Keys panel distinguishes "Kill-switched" from "Not set" precisely so
these do not look the same.

**A key was just added and nothing changed.** Redeploy. Environment variables
are baked in at build time.

---

## Cost controls

Three layers, weakest last. Only layer 1 still works when this app does not.

### Layer 1 — provider-side hard caps (owner action, not code)

Set a monthly spend limit in each pay-per-use console. Nothing in this repo can
substitute for these; they are the only control that survives a bad deploy, an
unreachable ledger, or a key leaking.

- OpenAI, Anthropic, xAI, Perplexity — monthly usage limit in the billing console
- OpenRouter — keep it on prepaid credits, never a linked card
- Vercel — Billing → Spend Management

Flat-rate providers (Polygon, FMP, TwelveData, Apify, ScrapingBee, SerpAPI) and
free tiers cannot overspend: exceeding the plan throttles or 429s, it does not
bill more. The dollar risk is entirely the metered AI keys.

### Layer 2 — the budget guard (AUDIT_BACKLOG E-5)

A Vercel cron computes spend from the Supabase `api_calls` ledger × the list
prices in `lib/api-costs.ts`, and cuts off pay-per-use keys when a hard stop is
breached. Cut-off keys resolve to `""` through `resolveApiKey`, so the app falls
back to its free AI path rather than erroring.

\`\`\`bash
# Hard stops, USD. Omit for the defaults ($50 / $100).
DAILY_BUDGET_HARD_STOP="50"
MONTHLY_BUDGET_HARD_STOP="100"

# Required — the cron refuses to run unauthenticated rather than defaulting open.
CRON_SECRET="a-long-random-string"

# Required for durable metering; without them the guard reports UNKNOWN and
# fails OPEN (it will not cut anything off).
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."

# Where the shutoff notification goes (reuses the admin address).
ADMIN_EMAIL="..."
RESEND_API_KEY="..."
\`\`\`

Deploy prerequisites:

1. Apply `supabase/migrations/0002_ai_spend.sql` — adds the token/cost columns,
   the `api_spend_daily` view, and the `budget_state` kill-flag table.
2. Set `CRON_SECRET` in the Vercel project.
3. Confirm the Vercel plan allows the `*/10 * * * *` schedule in `vercel.json`.
   Sub-daily cron frequency is a paid-plan feature; on Hobby the deploy will be
   rejected and the schedule has to be a once-daily expression (e.g. `0 6 * * *`).
   A once-daily guard still works — it just checks spend once a day instead of
   every ten minutes, which makes layer 1 that much more important.

Spend figures are **estimates** from vendor list prices (dated in
`TOKEN_PRICES_AS_OF`), not invoices. Calls using a model with no price on file
are counted separately as "unpriced" and are excluded from the total — the admin
panel says so rather than reporting them as free. Day boundaries are **UTC**,
because the rollup buckets on `date_trunc('day', ts)` in the database.

### Layer 3 — `DISABLED_APIS` (manual)

Comma-separated canonical key names that resolve to `""` regardless of spend.
Requires a redeploy to change, so it is the deliberate off-switch, not the
automatic one.

\`\`\`bash
DISABLED_APIS="TWELVE_DATA_API_KEY,APIFY_API_TOKEN"
\`\`\`

---

## Admin authentication

### Password

Prefer a hash over the plaintext env var:

\`\`\`bash
node scripts/hash-admin-password.ts
\`\`\`

It prompts with echo disabled (nothing lands in shell history), then prints an
`ADMIN_PASSWORD_HASH` value — scrypt, salted, via `node:crypto`, no extra
dependency.

\`\`\`bash
ADMIN_EMAIL="you@example.com"

# Preferred. Mark it Sensitive in Vercel.
ADMIN_PASSWORD_HASH="scrypt:<saltHex>:<hashHex>"

# Legacy fallback. Still honoured so setting the hash is a migration, not a
# lockout. Delete it only after confirming you can log in with the hash.
ADMIN_PASSWORD="..."
\`\`\`

Migration order matters — get this wrong and you lock yourself out:

1. Add `ADMIN_PASSWORD_HASH` for **both** Preview and Production.
2. Redeploy. Env vars only take effect on a new build.
3. Log in at `/login` and confirm it works.
4. **Only then** delete `ADMIN_PASSWORD`.

`lib/auth.ts` prefers the hash and falls back to the plaintext, so having both
set simultaneously is safe and is the whole point of the overlap.

### Brute-force rate limiting

Failed sign-ins are counted per client IP in the Supabase `login_attempts`
table (migration `0003_login_attempts.sql`). Past the threshold the endpoint
answers `429` with `Retry-After` until the oldest failure ages out. The window
slides, so it never locks permanently.

\`\`\`bash
# Optional. Defaults shown.
LOGIN_MAX_FAILURES="10"
LOGIN_WINDOW_MINUTES="15"
\`\`\`

**It fails open.** If Supabase is unreachable or unconfigured, sign-ins are
allowed through unlimited and the fail-open is logged. That is deliberate for
this admin specifically: the credential is an environment variable, there is no
self-service reset, and the owner has already been locked out once — so a
database outage must not become an unrecoverable lockout. The trade is that
brute-force protection is only as available as Supabase.

### There is no password reset

`/api/auth/reset-password` returns `501` with the recovery procedure. The
credential is an environment variable and no web request can change one, so a
reset flow is impossible by construction rather than merely unbuilt. Recovery is
the four steps above. See AUDIT_BACKLOG P4-2 and P4-4.
