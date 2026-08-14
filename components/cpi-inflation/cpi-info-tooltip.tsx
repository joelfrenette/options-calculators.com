"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export function CpiInfoTooltip({ content, enabled }: { content: string; enabled: boolean }) {
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
