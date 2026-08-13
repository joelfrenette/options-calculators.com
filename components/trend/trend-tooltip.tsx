"use client"

/**
 * A tooltip that disappears entirely when the tab's tooltips toggle is off.
 *
 * Split out of `components/trend-analysis.tsx` (P6-13). It read `tooltipsEnabled`
 * from the component's closure and now takes it as a prop.
 */
import type React from "react"
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const ConditionalTooltip = ({
  children,
  content,
  enabled,
}: {
  children: React.ReactNode
  content: string
  enabled: boolean
}) => {
  if (!enabled) return <>{children}</>
  return (
    <UITooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </UITooltip>
  )
}
