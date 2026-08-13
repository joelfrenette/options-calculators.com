"use client"

/**
 * A tooltip that disappears entirely when the tab tooltips toggle is off.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13). It read `tooltipsEnabled`
 * from the component closure and now takes it as a prop.
 */
import type React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const PanicTooltip = ({
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
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}
