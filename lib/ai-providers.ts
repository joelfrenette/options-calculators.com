/**
 * AI Provider Configuration with Fallback Support
 *
 * Priority order (by speed/reliability):
 * 1. Groq (llama-3.3-70b) - Fastest inference
 * 2. OpenAI (gpt-4o-mini) - Fast, reliable
 * 3. Google (gemini-2.0-flash) - Good speed
 * 4. xAI/Grok (grok-2) - Good for market data
 * 5. Anthropic (claude-3-5-sonnet) - High quality
 * 6. OpenRouter - Fallback aggregator
 * 7. Perplexity - Search-augmented
 */

import { generateText, streamText, type CoreMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

const providerConfigs = [
  {
    name: "groq" as const,
    displayName: "Groq (Llama 3.3 70B)",
    key: () => process.env.GROQ_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
      }),
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "openai" as const,
    displayName: "OpenAI (GPT-4o Mini)",
    key: () => process.env.OPENAI_API_KEY,
    create: () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY! }),
    model: "gpt-4o-mini",
  },
  {
    name: "google" as const,
    displayName: "Google (Gemini 2.0 Flash)",
    key: () => process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    create: () => createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! }),
    model: "gemini-2.0-flash-exp",
  },
  {
    name: "xai" as const,
    displayName: "xAI (Grok 2)",
    key: () => process.env.XAI_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.XAI_API_KEY!,
        baseURL: "https://api.x.ai/v1",
      }),
    model: "grok-2-latest",
  },
  {
    name: "anthropic" as const,
    displayName: "Anthropic (Claude 3.5 Sonnet)",
    key: () => process.env.ANTHROPIC_API_KEY,
    create: () => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    model: "claude-3-5-sonnet-20241022",
  },
  {
    name: "openrouter" as const,
    displayName: "OpenRouter (Llama 3.3)",
    key: () => process.env.OPENROUTER_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
      }),
    model: "meta-llama/llama-3.3-70b-instruct",
  },
  {
    name: "perplexity" as const,
    displayName: "Perplexity (Sonar Large)",
    key: () => process.env.PERPLEXITY_API_KEY,
    create: () =>
      createOpenAI({
        apiKey: process.env.PERPLEXITY_API_KEY!,
        baseURL: "https://api.perplexity.ai",
      }),
    model: "llama-3.1-sonar-large-128k-online",
  },
]

export type ProviderName = (typeof providerConfigs)[number]["name"]

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
        prompt,
        messages,
        system,
        temperature,
        maxTokens,
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
        prompt,
        messages,
        system,
        temperature,
        maxTokens,
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
