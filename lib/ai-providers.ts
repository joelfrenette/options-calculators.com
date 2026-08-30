/**
 * AI Provider Configuration with Fallback Support
 *
 * ORDER CHANGED 2026-08-30: QUALITY FIRST, not cost first.
 *
 * This chain serves the REASONING paths — the CCPI executive summary and the
 * dashboard chat — where the model reads numbers this site has already measured
 * and says what they mean. The owner makes six-figure decisions on that output
 * and has stated cost is not a constraint at two users, so the best available
 * model goes first.
 *
 * WHY THE ORDER IS THE WHOLE CHANGE, not the slugs. `generateWithFallback`
 * returns on the FIRST provider that succeeds. Under the old cost-first order a
 * free auto-router answered essentially every request, so upgrading Anthropic
 * from slot 6 would have changed nothing at all — slot 6 was never reached.
 * Putting a better model in a chain does not make the chain better; putting it
 * first does.
 *
 * 1. Anthropic (claude-opus-5)      - best available, primary
 * 2. xAI/Grok (grok-4.6)            - KEY FORBIDDEN in prod, see below
 * 3. OpenAI (gpt-5.4-nano)          - ACCOUNT OUT OF CREDITS, see below
 * 4. Google (gemini-3.5-flash-lite) - corrected by the vendor, see below
 * 5. Groq (openai/gpt-oss-120b)     - free, fast; currently the one answering
 * 6. OpenRouter (:free model)       - free last resort
 * 7. Perplexity                     - search-augmented; slug NOT verified
 *
 * THIS IS NOT THE CHAIN FOR RECALLING MARKET NUMBERS. lib/*-market-data.ts asks
 * a model for "the current VIX" and parses the reply. A better model there
 * returns a more CONFIDENT wrong number, not a truer one — no LLM knows today's
 * VIX. Those fetchers deliberately stay on cheap models, and the real fix there
 * is a data feed, not a bigger model. Do not "upgrade" them to match this list.
 *
 * WHAT THE FIRST REAL CALL FOUND (2026-08-30 21:36Z). The `error_class` column
 * added the same day turned a week of guessing into one page load. Every
 * provider named its own cause, and no two were the same problem:
 *
 *   anthropic  claude-opus-5   bad_request      "`temperature` is deprecated
 *                                                for this model."  <- OURS
 *   xai        grok-4.6        auth             "Forbidden"        <- key
 *   openai     gpt-5.4-nano    unknown          "no credits remaining" <- billing
 *   google     gemini-2.5-...  model_not_found  vendor named the replacement
 *   groq       gpt-oss-120b    ok               answered, 1003 in / 400 out
 *
 * So the original "xAI failed 401 times" mystery was never only the retired
 * slug: **the xAI key itself is Forbidden**, and no slug change could have
 * fixed it. OpenAI's key is valid and its ACCOUNT is empty — a distinction the
 * old `ok:false`-and-nothing-else ledger could not express at all.
 *
 * Fixed here: the temperature bug (ours) and the Google slug, which the vendor
 * supplied in its own error text — "Please update your code to use
 * models/gemini-3.5-flash-lite". The xAI key and the OpenAI balance are the
 * owner's to resolve; until then the chain falls through to Groq and answers.
 *
 * SLUG PROVENANCE. claude-opus-5 and grok-4.6 are confirmed against Anthropic's
 * and xAI's own documentation; gemini-3.5-flash-lite is confirmed by Google's
 * own error response. `gpt-5.4-nano` remains UNVERIFIED — the account ran out
 * of credits before the model id was ever validated, so a `model_not_found` may
 * still be waiting behind the billing failure. Perplexity has never been called.
 */

import { generateText, streamText, type CoreMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { resolveApiKey } from "@/lib/api-keys"
import { recordAiCall } from "@/lib/metered-fetch"
import { ensureBudgetGuardFresh } from "@/lib/budget-guard"

// OpenRouter free auto-router (zero per-token cost). "openrouter/free" lets
// OpenRouter pick among whatever models are currently free, so it survives the
// free roster changing (the bug that broke a pinned DeepSeek slug). Pin a
// specific model via OPENROUTER_FREE_MODEL for consistent output, e.g.
// openai/gpt-oss-120b:free or nvidia/nemotron-3-ultra-550b-a55b:free.
const OPENROUTER_FREE_MODEL = process.env.OPENROUTER_FREE_MODEL || "openrouter/free"

const providerConfigs = [
  {
    // PRIMARY — best available model. Paid and first on purpose: see the
    // quality-first note in this file's header.
    name: "anthropic" as const,
    displayName: "Anthropic (Claude Opus 5)",
    keyName: "ANTHROPIC_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.anthropic.com/v1/messages",
    key: () => resolveApiKey("ANTHROPIC_API_KEY"),
    create: () => createAnthropic({ apiKey: resolveApiKey("ANTHROPIC_API_KEY") }),
    model: "claude-opus-5",
  },
  {
    name: "xai" as const,
    displayName: "xAI (Grok 4.6)",
    keyName: "XAI_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.x.ai/v1/chat/completions",
    key: () => resolveApiKey("XAI_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("XAI_API_KEY"),
        baseURL: "https://api.x.ai/v1",
      }),
    model: "grok-4.6",
  },
  {
    name: "openai" as const,
    displayName: "OpenAI (GPT-5.4 Nano)",
    keyName: "OPENAI_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.openai.com/v1/chat/completions",
    key: () => resolveApiKey("OPENAI_API_KEY"),
    create: () => createOpenAI({ apiKey: resolveApiKey("OPENAI_API_KEY") }),
    model: "gpt-5.4-nano",
  },
  {
    name: "google" as const,
    displayName: "Google (Gemini 3.5 Flash-Lite)",
    keyName: "GOOGLE_AI_API_KEY",
    tier: "free" as const,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    key: () => resolveApiKey("GOOGLE_AI_API_KEY"),
    create: () => createGoogleGenerativeAI({ apiKey: resolveApiKey("GOOGLE_AI_API_KEY") }),
    model: "gemini-3.5-flash-lite",
  },
  // --- free tiers, now the SAFETY NET rather than the default. They answer
  //     when every paid provider is down or the E-5 budget guard has tripped,
  //     which is exactly when a cheaper answer beats no answer. ---
  {
    name: "groq" as const,
    displayName: "Groq (GPT-OSS 120B)",
    keyName: "GROQ_API_KEY",
    tier: "free" as const,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    key: () => resolveApiKey("GROQ_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("GROQ_API_KEY"),
        baseURL: "https://api.groq.com/openai/v1",
      }),
    model: "openai/gpt-oss-120b",
  },
  {
    // $0 per token; one-time $10 deposit raises the daily cap to 1,000
    // requests. Was slot 1 under the old cost-first order, which is why it
    // served nearly every request and why the five providers behind it could
    // rot unnoticed for weeks.
    name: "openrouter" as const,
    displayName: "OpenRouter (free model)",
    keyName: "OPENROUTER_API_KEY",
    tier: "free" as const,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    key: () => resolveApiKey("OPENROUTER_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("OPENROUTER_API_KEY"),
        baseURL: "https://openrouter.ai/api/v1",
      }),
    model: OPENROUTER_FREE_MODEL,
  },
  {
    name: "perplexity" as const,
    displayName: "Perplexity (Sonar Large)",
    keyName: "PERPLEXITY_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.perplexity.ai/chat/completions",
    key: () => resolveApiKey("PERPLEXITY_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("PERPLEXITY_API_KEY"),
        baseURL: "https://api.perplexity.ai",
      }),
    model: "llama-3.1-sonar-large-128k-online",
  },
]

export type ProviderName = (typeof providerConfigs)[number]["name"]

/**
 * Whether a model still accepts sampling parameters (`temperature`, `top_p`,
 * `top_k`).
 *
 * Anthropic REMOVED them on the Opus 5 / Opus 4.8 / Opus 4.7 / Sonnet 5 /
 * Fable 5 family: sending `temperature` returns a 400. Promoting claude-opus-5
 * to the front of this chain therefore broke it on the first real call, and the
 * ledger said so in as many words —
 *
 *     provider=anthropic model=claude-opus-5 ok=false
 *     error_class=bad_request  detail="`temperature` is deprecated for this model."
 *
 * That is exactly the diagnosis `error_class` was added for the same day, on a
 * failure that would previously have recorded `ok:false` and nothing else. The
 * chain silently fell through to Groq and still answered, so nothing user-facing
 * broke and nothing would ever have pointed here.
 *
 * Matched by prefix rather than an exact list so a dated snapshot of the same
 * family (`claude-opus-5-20260xxx`) is covered too. Reasoning depth on these
 * models is controlled by `output_config.effort`, not by temperature.
 */
function acceptsSampling(model: string): boolean {
  return !/^claude-(opus-5|opus-4-8|opus-4-7|sonnet-5|fable-5|mythos-5)/.test(model)
}

/**
 * Read-only description of one link in the REAL fallback chain.
 *
 * AUDIT_BACKLOG A-7: the admin AI tab used to hand-maintain this list and got
 * the order backwards (it claimed OpenAI was tried first; OpenAI is #4). Every
 * field below is derived from `providerConfigs` above — the same array
 * `generateWithFallback` / `streamWithFallback` iterate — so the panel cannot
 * drift from the code again. Nothing here changes provider behavior.
 */
export interface AIProviderDescriptor {
  /** 1-based position in the order the chain is actually tried. */
  order: number
  name: ProviderName
  displayName: string
  /** The model id actually requested (resolved at call time, env overrides included). */
  model: string
  /** Canonical key name in lib/api-keys.ts. */
  keyName: string
  /** Free-tier provider ($0 per token) vs pay-per-use. */
  tier: "free" | "paid"
  endpoint: string
  /**
   * Key resolved via `resolveApiKey` — false when unset OR kill-switched via
   * DISABLED_APIS. A provider with `hasKey:false` is skipped by the chain.
   */
  hasKey: boolean
}

/**
 * The live fallback chain, in the exact order the generate/stream loops try it.
 * Read-only: callers get a fresh array of plain objects, never the configs.
 */
export function getProviderChain(): AIProviderDescriptor[] {
  return providerConfigs.map((config, index) => ({
    order: index + 1,
    name: config.name,
    displayName: config.displayName,
    model: config.model,
    keyName: config.keyName,
    tier: config.tier,
    endpoint: config.endpoint,
    hasKey: !!config.key(),
  }))
}

export interface AIGenerateOptions {
  prompt?: string
  messages?: CoreMessage[]
  system?: string
  temperature?: number
  maxTokens?: number
  preferredProvider?: ProviderName
  abortSignal?: AbortSignal
  /** Calling route, recorded with the spend row so cost can be attributed. */
  routeTag?: string
}

export interface AIGenerateResult {
  text: string
  provider: string
  model: string
}

/**
 * Generate text with automatic fallback between providers
 * Tries each provider in order until one succeeds
 */
export async function generateWithFallback(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const {
    prompt,
    messages,
    system,
    temperature = 0.7,
    maxTokens = 1000,
    preferredProvider,
    abortSignal,
    routeTag,
  } = options

  // Build the list of providers to try (preferred first if specified)
  const configsToTry = preferredProvider
    ? [
        providerConfigs.find((c) => c.name === preferredProvider),
        ...providerConfigs.filter((c) => c.name !== preferredProvider),
      ].filter(Boolean)
    : providerConfigs

  // Budget guard (E-5). This is the one path that can actually spend money, and
  // it is async, so it does the accurate check rather than relying on the
  // best-effort sync snapshot: refresh first, then `config.key()` below returns
  // "" for every guarded provider and the chain skips straight past them to the
  // free tiers. Fails open if Supabase is unreachable — see lib/budget-guard.ts.
  await ensureBudgetGuardFresh()

  let lastError: Error | null = null

  for (const config of configsToTry) {
    if (!config || !config.key()) continue

    const started = Date.now()
    // The call is metered exactly once. The empty-response throw below lands in
    // the catch, which would otherwise log a SECOND row for the same call and
    // inflate both the count and the cost.
    let metered = false
    try {
      console.log(`[AI] Trying ${config.displayName}...`)
      const provider = config.create()
      const model = provider(config.model)

      const result = await generateText({
        model,
        // ai v5's Prompt type is a union: pass `messages` XOR `prompt`, never both keys.
        // The cast covers the caller-supplied-neither case, which the SDK rejects at runtime as before.
        ...(messages !== undefined ? { messages } : { prompt: prompt as string }),
        system,
        ...(acceptsSampling(config.model) ? { temperature } : {}),
        maxOutputTokens: maxTokens,
        abortSignal,
      })

      // Spend accounting (E-5). A failed attempt is recorded too: a provider
      // that errors after consuming tokens still bills, and a fallback chain
      // that burns three paid providers per request is exactly the runaway
      // pattern the guard needs to see.
      //
      // Recorded as ok:true BEFORE the empty-text check, and deliberately so:
      // a provider that returns nothing still consumed tokens and still bills.
      // Marking that row ok:false would say the call failed when it was
      // charged, which is the opposite error from the one this ledger exists
      // to prevent.
      recordAiCall({
        provider: config.name,
        model: config.model,
        route: routeTag ?? null,
        ms: Date.now() - started,
        ok: true,
        usage: result.usage,
      })
      metered = true

      // An empty completion is a FAILED completion, and the chain must fall
      // through to the next provider rather than hand "" back to the caller.
      // This check lived only in /api/ccpi/executive-summary's private copy of
      // this loop; every other caller of generateWithFallback could silently
      // receive an empty string and render it. On that route the empty string
      // would have been displayed AS the executive summary.
      if (!result.text || result.text.trim().length === 0) {
        throw new Error(`${config.displayName} returned an empty response`)
      }

      console.log(`[AI] Success with ${config.displayName}`)

      return {
        text: result.text,
        provider: config.name,
        model: config.model,
      }
    } catch (error) {
      console.error(`[AI] ${config.displayName} failed:`, error instanceof Error ? error.message : error)
      if (metered) {
        // Already counted above; only the fallthrough matters here.
        lastError = error instanceof Error ? error : new Error(String(error))
        continue
      }
      recordAiCall({
        provider: config.name,
        model: config.model,
        route: routeTag ?? null,
        ms: Date.now() - started,
        ok: false,
        // No usage on a thrown call — the row lands unpriced rather than $0.
        usage: null,
        // The cause travels with the row. Without it a fallback that silently
        // burns through every provider looks identical to one that was never
        // tried — see lib/ai-error-class.ts.
        error,
      })
      lastError = error instanceof Error ? error : new Error(String(error))
      // Continue to next provider
    }
  }

  throw lastError || new Error("No AI providers available")
}

/**
 * Stream text with automatic fallback between providers
 */
export async function streamWithFallback(options: AIGenerateOptions) {
  const {
    prompt,
    messages,
    system,
    temperature = 0.7,
    maxTokens = 1000,
    preferredProvider,
    abortSignal,
    routeTag,
  } = options

  // Build the list of providers to try
  const configsToTry = preferredProvider
    ? [
        providerConfigs.find((c) => c.name === preferredProvider),
        ...providerConfigs.filter((c) => c.name !== preferredProvider),
      ].filter(Boolean)
    : providerConfigs

  // Budget guard (E-5). This is the one path that can actually spend money, and
  // it is async, so it does the accurate check rather than relying on the
  // best-effort sync snapshot: refresh first, then `config.key()` below returns
  // "" for every guarded provider and the chain skips straight past them to the
  // free tiers. Fails open if Supabase is unreachable — see lib/budget-guard.ts.
  await ensureBudgetGuardFresh()

  let lastError: Error | null = null

  for (const config of configsToTry) {
    if (!config || !config.key()) continue

    const started = Date.now()
    try {
      console.log(`[AI] Streaming with ${config.displayName}...`)
      const provider = config.create()
      const model = provider(config.model)

      const result = streamText({
        model,
        // ai v5's Prompt type is a union: pass `messages` XOR `prompt`, never both keys.
        // The cast covers the caller-supplied-neither case, which the SDK rejects at runtime as before.
        ...(messages !== undefined ? { messages } : { prompt: prompt as string }),
        system,
        ...(acceptsSampling(config.model) ? { temperature } : {}),
        maxOutputTokens: maxTokens,
        abortSignal,
      })

      console.log(`[AI] Stream started with ${config.displayName}`)

      // Spend accounting (E-5). streamText resolves `usage` only once the
      // stream finishes, so this is deliberately not awaited — awaiting it
      // here would block the caller until generation completed and defeat the
      // point of streaming. Metering must never change call behavior.
      void Promise.resolve(result.usage)
        .then((usage) =>
          recordAiCall({
            provider: config.name,
            model: config.model,
            route: routeTag ?? null,
            ms: Date.now() - started,
            ok: true,
            usage,
          }),
        )
        .catch((error: unknown) =>
          recordAiCall({
            provider: config.name,
            model: config.model,
            route: routeTag ?? null,
            ms: Date.now() - started,
            ok: false,
            usage: null,
            // This callback used to discard its argument. A stream that fails
            // mid-flight is the hardest failure to reproduce, so it is the one
            // that most needs its cause on the row.
            error,
          }),
        )

      return {
        stream: result,
        provider: config.name,
        model: config.model,
      }
    } catch (error) {
      console.error(`[AI] ${config.displayName} stream failed:`, error instanceof Error ? error.message : error)
      recordAiCall({
        provider: config.name,
        model: config.model,
        route: routeTag ?? null,
        ms: Date.now() - started,
        ok: false,
        usage: null,
        error,
      })
      lastError = error instanceof Error ? error : new Error(String(error))
      // Continue to next provider
    }
  }

  throw lastError || new Error("No AI providers available for streaming")
}

// `getProviderStatus` was deleted here (P7-9). It answered "which providers
// have a resolvable key", which is a strict subset of what `getProviderChain`
// above already returns — same source array, same `config.key()` call, minus
// the order, model, tier and endpoint the admin panel actually renders. Nothing
// called it. Two functions deriving one answer from one array is how the panel
// drifts from the chain, which is the defect `getProviderChain` exists to
// prevent.
