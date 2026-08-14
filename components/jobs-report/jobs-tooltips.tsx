"use client"

/**
 * The tab's two tooltip wrappers. Split from
 * components/jobs-report-dashboard.tsx (P6-13); both read the Tooltips toggle
 * through an `enabled` prop rather than a closure, which is what P7-81 found
 * the social-sentiment copy failing to do.
 */

import type React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export function InfoTooltip({ content, enabled }: { content: string; enabled: boolean }) {
  if (!enabled) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
        <p className="text-sm text-gray-700">{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export function CardTooltip({
  content,
  enabled,
  children,
}: {
  content: string
  enabled: boolean
  children: React.ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-sm bg-white border shadow-lg p-3">
        <p className="text-sm text-gray-700">{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}
