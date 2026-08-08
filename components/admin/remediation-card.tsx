"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Check, Copy, ExternalLink, Hourglass, UserRound, Wrench } from "lucide-react"

/**
 * Renders one remediation — the "what do I do about it" half of the Health tab.
 *
 * Purely presentational: it takes a result and the Remediation that diagnose()
 * (lib/remediation.ts) produced for it, and does no fetching or classification
 * of its own. The prop types are declared structurally here rather than imported
 * so this file stays self-contained; the shapes in lib/remediation.ts satisfy
 * them, so `<RemediationCard result={r} remediation={diagnose(r, { keys })} />`
 * type-checks without a cast.
 */

export interface RemediationCardResult {
  path: string
  method?: string
  status?: string
  httpStatus?: number | null
  latencyMs?: number | null
  budgetMs?: number
  detail?: string | null
  tabs?: string[]
}

export interface RemediationCardLink {
  label: string
  url: string
}

export interface RemediationCardRemediation {
  owner: "owner" | "claude" | "upstream"
  confidence: "certain" | "likely"
  headline: string
  why: string
  steps: string[]
  claudePrompt?: string
  links?: RemediationCardLink[]
  autoFixable: boolean
}

/** Who acts, in the plainest words available, with a colour you can scan for. */
const OWNER_META: Record<
  RemediationCardRemediation["owner"],
  { label: string; hint: string; chip: string; accent: string; Icon: typeof UserRound }
> = {
  owner: {
    label: "YOU",
    hint: "needs a dashboard, billing or env-var change",
    chip: "bg-amber-100 text-amber-900 border border-amber-300",
    accent: "border-l-4 border-l-amber-400",
    Icon: UserRound,
  },
  claude: {
    label: "CLAUDE",
    hint: "needs a code change in this repo",
    chip: "bg-violet-100 text-violet-900 border border-violet-300",
    accent: "border-l-4 border-l-violet-400",
    Icon: Bot,
  },
  upstream: {
    label: "WAIT",
    hint: "upstream problem — re-check shortly",
    chip: "bg-slate-100 text-slate-700 border border-slate-300",
    accent: "border-l-4 border-l-slate-400",
    Icon: Hourglass,
  },
}

export function RemediationCard({
  result,
  remediation,
}: {
  result: RemediationCardResult
  remediation: RemediationCardRemediation
}) {
  const [copied, setCopied] = useState(false)
  const meta = OWNER_META[remediation.owner]
  const { Icon } = meta

  const copyPrompt = async () => {
    if (!remediation.claudePrompt) return
    try {
      await navigator.clipboard.writeText(remediation.claudePrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied (insecure origin, permissions policy).
      // Say so rather than showing a success tick for something that did not
      // happen — the prompt stays selectable in the box below either way.
      setCopied(false)
    }
  }

  return (
    <Card className={`bg-white ${meta.accent}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${meta.chip}`}
            title={meta.hint}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          <span className="font-mono text-xs text-slate-500">{result.path}</span>
          {result.httpStatus !== null && result.httpStatus !== undefined && (
            <span className="font-mono text-xs text-slate-400">HTTP {result.httpStatus}</span>
          )}
          {remediation.confidence === "likely" && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400" title="Best explanation for this symptom, not a certainty">
              likely cause
            </span>
          )}
          {remediation.autoFixable && (
            <span
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700"
              title="A code change alone fixes this"
            >
              <Wrench className="h-3 w-3" /> fixable in code
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm font-semibold text-slate-900">{remediation.headline}</p>
        <p className="text-sm text-slate-600">{remediation.why}</p>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Next steps</p>
          <ol className="list-decimal ml-5 space-y-1 text-sm text-slate-700">
            {remediation.steps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`}>{step}</li>
            ))}
          </ol>
        </div>

        {remediation.claudePrompt && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt for Claude Code</p>
              <Button
                type="button"
                onClick={copyPrompt}
                className="h-7 px-2 text-xs bg-violet-600 hover:bg-violet-700 text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy prompt for Claude
                  </>
                )}
              </Button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-2 text-[11px] leading-relaxed text-slate-700">
              {remediation.claudePrompt}
            </pre>
          </div>
        )}

        {remediation.links && remediation.links.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Where to go</p>
            <ul className="space-y-1">
              {remediation.links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.detail && (
          <p className="text-[11px] font-mono text-slate-400 break-words">
            Reported: {result.detail}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
