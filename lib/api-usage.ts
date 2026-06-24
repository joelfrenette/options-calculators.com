// Lightweight API usage counter.
//
// NOTE: This stores counts in-memory per serverless instance, so on Vercel the
// numbers reset whenever a new lambda spins up and are NOT shared across
// instances. It's a best-effort, indicative signal — useful in long-running
// dev and as a relative gauge. For durable, accurate usage accounting connect
// a KV store (Vercel KV / Upstash) or the existing Supabase project and swap
// the implementation of recordApiUsage/getUsageStats below.

interface UsageEntry {
  count: number
  lastUsedISO: string | null
}

const usage = new Map<string, UsageEntry>()

// Record one call to a service (pass the canonical key name from lib/api-keys.ts).
export function recordApiUsage(service: string, isoTimestamp?: string): void {
  const entry = usage.get(service) ?? { count: 0, lastUsedISO: null }
  entry.count += 1
  if (isoTimestamp) entry.lastUsedISO = isoTimestamp
  usage.set(service, entry)
}

export function getUsageStats(): Record<string, UsageEntry> {
  const result: Record<string, UsageEntry> = {}
  for (const [service, entry] of usage.entries()) {
    result[service] = { ...entry }
  }
  return result
}

export function getServiceUsage(service: string): UsageEntry {
  return usage.get(service) ?? { count: 0, lastUsedISO: null }
}
