"use client"

/**
 * Drop-in "Email this report" button for any page that can shape its results
 * into a ReportPayload (lib/reports/types.ts). The page owns the data — its
 * columns, its ranking (rows are sent in order; the top N lead the email),
 * its executive summary. This component only POSTs to /api/report-email,
 * which emails the Excel + PDF + formatted body to the signed-in user.
 *
 * Usage:
 *   <EmailReportButton payload={() => buildPayload(results)} />
 *
 * `payload` is a function so the current results are captured at click time,
 * not at render. It may return null to mean "nothing to send yet" (the button
 * shows a hint instead of emailing).
 */

import { useState } from "react"
import { Mail, Check, Loader2 } from "lucide-react"
import type { ReportPayload } from "@/lib/reports/types"

type State = "idle" | "sending" | "sent" | "error"

export function EmailReportButton({
  payload,
  className,
  label = "Email report",
}: {
  payload: () => ReportPayload | null
  className?: string
  label?: string
}) {
  const [state, setState] = useState<State>("idle")
  const [note, setNote] = useState<string | null>(null)

  const send = async () => {
    const data = payload()
    if (!data) {
      setState("error")
      setNote("Run the scan first — there is nothing to send yet.")
      return
    }
    setState("sending")
    setNote(null)
    try {
      const res = await fetch("/api/report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => null)
      if (res.ok) {
        setState("sent")
        setNote(`Sent to ${body?.sentTo ?? "your email"}.`)
        setTimeout(() => setState("idle"), 4000)
      } else {
        setState("error")
        setNote(body?.error || `Send failed (HTTP ${res.status})`)
      }
    } catch {
      setState("error")
      setNote("Could not reach the email service.")
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className={
          className ||
          "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60 transition-colors"
        }
      >
        {state === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "sent" ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {state === "sending" ? "Sending…" : state === "sent" ? "Sent" : label}
      </button>
      {note && (
        <span className={`text-xs ${state === "error" ? "text-red-600" : "text-gray-500"}`}>{note}</span>
      )}
    </div>
  )
}
