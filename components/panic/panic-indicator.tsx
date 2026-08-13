"use client"

/**
 * The gradient bar and the single-component indicator row.
 *
 * Split out of `components/panic-euphoria.tsx` (P6-13) unchanged.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"

export function PanicGradientBar({ value, min = -1, max = 1 }: { value: number; min?: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const marginLeft = `${percentage}%`

  return (
    <div className="relative w-full h-3 rounded-full overflow-hidden">
      {/* Reversed gradient: Green (Panic/Good) on LEFT, Red (Euphoria/Bad) on RIGHT */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
      <div className="absolute inset-0 bg-gray-200" style={{ marginLeft }} />
    </div>
  )
}

export function PanicIndicator({
  label,
  value,
  rawValue,
  tooltip,
  min = -1,
  max = 1,
}: {
  label: string
  // Null when the component has no score yet — the percentile-scored series
  // withhold theirs until 8 days of history accumulate. `?? 0` at the call
  // sites parked the bar on the exact midpoint of a -1..+1 scale, which is a
  // NEUTRAL reading, not an absent one. The tooltips even documented the
  // behaviour ("the score bar reads 0.00 until 8 days accumulate") — a label
  // describing an arithmetic problem rather than fixing it.
  value: number | null
  rawValue: string
  tooltip: string
  min?: number
  max?: number
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm bg-gray-900 text-white border-gray-700 z-50 p-3 shadow-xl">
                <p className="text-sm leading-relaxed">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{rawValue}</span>
          <Badge
            variant={value === null ? "outline" : value <= -0.5 ? "default" : value >= 0.5 ? "destructive" : "secondary"}
            className="min-w-[60px] justify-center"
          >
            {value === null ? "no score" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}`}
          </Badge>
        </div>
      </div>
      {value === null ? (
        <div className="h-2 w-full rounded-full bg-gray-200 flex items-center justify-center">
          <span className="text-[10px] text-gray-500">not scored yet — needs more stored history</span>
        </div>
      ) : (
        <PanicGradientBar value={value} min={min} max={max} />
      )}
    </div>
  )
}
