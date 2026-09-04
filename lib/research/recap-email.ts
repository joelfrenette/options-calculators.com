// Research Queue — the morning-recap email (Phase 3).
//
// Reuses the Resend path and the same fixed sender as the report exports. `to` is
// always an owner_email already in the queue table — never an address from a
// request body — so this can never become a mailer for arbitrary recipients.
// Sent only when something actually changed (see lib/research/refresh.ts); a
// nightly "nothing changed" email would be noise.

import { Resend } from "resend"
import { resolveApiKey } from "@/lib/api-keys"
import type { RecapItem } from "./types"

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

export async function sendRecapEmail(to: string, summary: string, items: RecapItem[]): Promise<boolean> {
  const key = resolveApiKey("RESEND_API_KEY")
  if (!key) return false

  const list = items.length
    ? `<ul style="padding-left:18px;color:#334155">${items.map((i) => `<li style="margin:4px 0">${escapeHtml(i.detail)}</li>`).join("")}</ul>`
    : "<p style=\"color:#334155\">No changes overnight.</p>"

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;line-height:1.5">
    <h2 style="margin:0 0 8px;font-size:18px">Research Queue — morning recap</h2>
    <p style="color:#475569;margin:0 0 12px">${escapeHtml(summary)}</p>
    ${list}
    <p style="color:#94a3b8;font-size:12px;margin-top:16px">Computed from your queue overnight. The numbers are computed; the strategy and the read are written over them.</p>
  </div>`

  const text = `Research Queue — morning recap\n\n${summary}\n\n${items.map((i) => `- ${i.detail}`).join("\n")}`

  try {
    const { error } = await new Resend(key).emails.send({
      from: "Options Calculator <noreply@options-calculators.com>",
      to,
      subject: `Research Queue — morning recap (${new Date().toUTCString().replace("GMT", "UTC")})`,
      html,
      text,
    })
    return !error
  } catch {
    return false
  }
}
