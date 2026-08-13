"use client"

/**
 * The small (i) tooltip beside a heading, absent entirely when the tab's
 * tooltips toggle is off.
 *
 * Split out of `components/fomc-predictions.tsx` (P6-13). It read
 * `tooltipsEnabled` from the component's closure and now takes it as a prop —
 * the only change. Disabled still renders nothing at all rather than an empty
 * trigger.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export const InfoTooltip = ({ content, enabled }: { content: string; enabled: boolean }) => {
  if (!enabled) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help inline ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs bg-white border shadow-lg">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}
