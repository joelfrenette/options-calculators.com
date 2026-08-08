/**
 * AI Provider Configuration with Fallback Support
 *
 * Priority order (FREE providers first to minimize cost):
 * 1. OpenRouter (:free model) - $0 per token, primary
 * 2. Groq (llama-3.3-70b) - free tier backup
 * 3. Google (gemini-2.0-flash) - free tier backup
 * --- paid fallbacks below; only used if all free providers fail AND the key
 *     is set. Disable via DISABLED_APIS to guarantee $0. ---
 * 4. OpenAI (gpt-4o-mini)
 * 5. xAI/Grok (grok-2)
 * 6. Anthropic (claude-3-5-sonnet)
 * 7. Perplexity - search-augmented
 */

import { generateText, streamText, type CoreMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { resolveApiKey } from "@/lib/api-keys"

// OpenRouter free auto-router (zero per-token cost). "openrouter/free" lets
// OpenRouter pick among whatever models are currently free, so it survives the
// free roster changing (the bug that broke a pinned DeepSeek slug). Pin a
// specific model via OPENROUTER_FREE_MODEL for consistent output, e.g.
// openai/gpt-oss-120b:free or nvidia/nemotron-3-ultra-550b-a55b:free.
const OPENROUTER_FREE_MODEL = process.env.OPENROUTER_FREE_MODEL || "openrouter/free"

const providerConfigs = [
  {
    // PRIMARY — OpenRouter free model. $0 per token; one-time $10 deposit
    // raises the daily cap to 1,000 requests.
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
    // Free backup.
    name: "groq" as const,
    displayName: "Groq (Llama 3.3 70B)",
    keyName: "GROQ_API_KEY",
    tier: "free" as const,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    key: () => resolveApiKey("GROQ_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("GROQ_API_KEY"),
        baseURL: "https://api.groq.com/openai/v1",
      }),
    model: "llama-3.3-70b-versatile",
  },
  {
    // Free backup.
    name: "google" as const,
    displayName: "Google (Gemini 2.0 Flash)",
    keyName: "GOOGLE_AI_API_KEY",
    tier: "free" as const,
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    key: () => resolveApiKey("GOOGLE_AI_API_KEY"),
    create: () => createGoogleGenerativeAI({ apiKey: resolveApiKey("GOOGLE_AI_API_KEY") }),
    model: "gemini-2.0-flash",
  },
  // --- paid fallbacks below; reachable only if all free providers fail AND
  //     their keys are set (disable via DISABLED_APIS to guarantee $0). ---
  {
    name: "openai" as const,
    displayName: "OpenAI (GPT-4o Mini)",
    keyName: "OPENAI_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.openai.com/v1/chat/completions",
    key: () => resolveApiKey("OPENAI_API_KEY"),
    create: () => createOpenAI({ apiKey: resolveApiKey("OPENAI_API_KEY") }),
    model: "gpt-4o-mini",
  },
  {
    name: "xai" as const,
    displayName: "xAI (Grok 2)",
    keyName: "XAI_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.x.ai/v1/chat/completions",
    key: () => resolveApiKey("XAI_API_KEY"),
    create: () =>
      createOpenAI({
        apiKey: resolveApiKey("XAI_API_KEY"),
        baseURL: "https://api.x.ai/v1",
      }),
    model: "grok-2-latest",
  },
  {
    name: "anthropic" as const,
    displayName: "Anthropic (Claude 3.5 Sonnet)",
    keyName: "ANTHROPIC_API_KEY",
    tier: "paid" as const,
    endpoint: "https://api.anthropic.com/v1/messages",
    key: () => resolveApiKey("ANTHROPIC_API_KEY"),
    create: () => createAnthropic({ apiKey: resolveApiKey("ANTHROPIC_API_KEY") }),
    model: "claude-3-5-sonnet-20241022",
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
  const { prompt, messages, system, temperature = 0.7, maxTokens = 1000, preferredProvider, abortSignal } = options

  // Build the list of providers to try (preferred first if specified)
  const configsToTry = preferredProvider
    ? [
        providerConfigs.find((c) => c.name === preferredProvider),
        ...providerConfigs.filter((c) => c.name !== preferredProvider),
      ].filter(Boolean)
    : providerConfigs

  let lastError: Error | null = null

  for (const config of configsToTry) {
    if (!config || !config.key()) continue

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
        temperature,
        maxOutputTokens: maxTokens,
        abortSignal,
      })

      console.log(`[AI] Success with ${config.displayName}`)

      return {
        text: result.text,
        provider: config.name,
        model: config.model,
      }
    } catch (error) {
      console.error(`[AI] ${config.displayName} failed:`, error instanceof Error ? error.message : error)
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
  const { prompt, messages, system, temperature = 0.7, maxTokens = 1000, preferredProvider, abortSignal } = options

  // Build the list of providers to try
  const configsToTry = preferredProvider
    ? [
        providerConfigs.find((c) => c.name === preferredProvider),
        ...providerConfigs.filter((c) => c.name !== preferredProvider),
      ].filter(Boolean)
    : providerConfigs

  let lastError: Error | null = null

  for (const config of configsToTry) {
    if (!config || !config.key()) continue

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
        temperature,
        maxOutputTokens: maxTokens,
        abortSignal,
      })

      console.log(`[AI] Stream started with ${config.displayName}`)

      return {
        stream: result,
        provider: config.name,
        model: config.model,
      }
    } catch (error) {
      console.error(`[AI] ${config.displayName} stream failed:`, error instanceof Error ? error.message : error)
      lastError = error instanceof Error ? error : new Error(String(error))
      // Continue to next provider
    }
  }

  throw lastError || new Error("No AI providers available for streaming")
}

/**
 * Get list of available providers with their status
 */
export function getProviderStatus(): Record<ProviderName, { available: boolean; name: string }> {
  const status: Record<string, { available: boolean; name: string }> = {}

  for (const config of providerConfigs) {
    status[config.name] = {
      available: !!config.key(),
      name: config.displayName,
    }
  }

  return status as Record<ProviderName, { available: boolean; name: string }>
}
