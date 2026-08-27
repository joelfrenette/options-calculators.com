"use client"

/**
 * "Export ▾" menu for any results table: Download PDF, Download Excel, Email to
 * me. Replaces the plain email button (owner ask 2026-08-27). The page owns the
 * data via `payload()` (evaluated at click time so it captures the current
 * rows); this component turns it into a file download or an email through the
 * shared /api/report/* routes. Self-contained dropdown — no UI dependency.
 *
 * Downloads: the file comes back from /api/report/download as a blob, saved via
 * a temporary object URL. This is the signed-in user saving their own report in
 * their own browser — no third party, no upload.
 */

import { useEffect, useRef, useState } from "react"
import { Download, FileText, FileSpreadsheet, Mail, Loader2, Check, ChevronDown } from "lucide-react"
import type { ReportPayload } from "@/lib/reports/types"

type Busy = null | "pdf" | "xlsx" | "email"

export function ExportMenu({
  payload,
  label = "Export",
  align = "right",
}: {
  payload: () => ReportPayload | null
  label?: string
  align?: "left" | "right"
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const slug = (data: ReportPayload) => {
    const t = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, "0")
    return `${t || "report"}-${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`
  }

  const download = async (format: "pdf" | "xlsx") => {
    const data = payload()
    if (!data) {
      setNote("Nothing to export yet — load the results first.")
      return
    }
    setBusy(format)
    setNote(null)
    setOk(false)
    try {
      const res = await fetch("/api/report/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, format }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setNote(body?.error || `Export failed (HTTP ${res.status})`)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${slug(data)}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setOk(true)
      setOpen(false)
      setTimeout(() => setOk(false), 3000)
    } catch {
      setNote("Could not reach the export service.")
    } finally {
      setBusy(null)
    }
  }

  const email = async () => {
    const data = payload()
    if (!data) {
      setNote("Nothing to email yet — load the results first.")
      return
    }
    setBusy("email")
    setNote(null)
    setOk(false)
    try {
      const res = await fetch("/api/report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const body = await res.json().catch(() => null)
      if (res.ok) {
        setNote(`Emailed to ${body?.sentTo ?? "you"}.`)
        setOk(true)
        setOpen(false)
        setTimeout(() => setOk(false), 4000)
      } else {
        setNote(body?.error || `Email failed (HTTP ${res.status})`)
      }
    } catch {
      setNote("Could not reach the email service.")
    } finally {
      setBusy(null)
    }
  }

  const item =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60 text-left"

  return (
    <div className="relative inline-flex flex-col items-end" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <Download className="h-4 w-4" />}
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <button type="button" className={item} onClick={() => download("pdf")} disabled={busy !== null}>
            {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-red-600" />}
            Download PDF
          </button>
          <button type="button" className={item} onClick={() => download("xlsx")} disabled={busy !== null}>
            {busy === "xlsx" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            Download Excel
          </button>
          <div className="border-t border-gray-100" />
          <button type="button" className={item} onClick={email} disabled={busy !== null}>
            {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 text-blue-600" />}
            Email to me
          </button>
        </div>
      )}

      {note && <span className="mt-1 max-w-[16rem] text-right text-xs text-gray-500">{note}</span>}
    </div>
  )
}
