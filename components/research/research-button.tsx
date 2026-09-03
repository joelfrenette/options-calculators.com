"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FlaskConical, Check, Loader2 } from "lucide-react"

/**
 * Add a ticker to the research queue from anywhere a ticker renders
 * (RESEARCH_QUEUE_DESIGN.md — this is the reusable global button). Posts to
 * /api/research-queue, which researches inline and stores the recommendation.
 *
 * Deliberately self-contained: drop `<ResearchButton ticker="NVDA" />` beside
 * any symbol. Optional `size="icon"` for dense tables.
 */
export function ResearchButton({
  ticker,
  variant = "outline",
  compact = false,
}: {
  ticker: string
  variant?: "outline" | "ghost" | "secondary"
  compact?: boolean
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [msg, setMsg] = useState<string | null>(null)

  const add = async () => {
    if (state === "loading") return
    setState("loading")
    setMsg(null)
    try {
      const res = await fetch("/api/research-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState("error")
        setMsg(data?.error ?? `HTTP ${res.status}`)
        return
      }
      setState("done")
      const strat = data?.row?.recommendation?.strategy
      setMsg(strat ? `Queued — ${strat}` : "Queued")
    } catch {
      setState("error")
      setMsg("Request failed")
    }
  }

  return (
    <Button
      onClick={add}
      variant={variant}
      size={compact ? "sm" : "default"}
      disabled={state === "loading"}
      title={`Research ${ticker} for options (wheel / puts / LEAPS)`}
      className={compact ? "h-7 px-2 text-xs" : ""}
    >
      {state === "loading" ? (
        <Loader2 className={`${compact ? "h-3 w-3" : "h-4 w-4"} animate-spin`} />
      ) : state === "done" ? (
        <Check className={`${compact ? "h-3 w-3" : "h-4 w-4"} text-green-600`} />
      ) : (
        <FlaskConical className={compact ? "h-3 w-3" : "h-4 w-4"} />
      )}
      {!compact && <span className="ml-1">{state === "done" ? (msg ?? "Queued") : state === "error" ? "Retry" : "Research"}</span>}
    </Button>
  )
}
