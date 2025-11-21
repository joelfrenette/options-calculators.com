// Status badge component for API live/fallback status
// Used throughout the dashboard to show data source status

import { Badge } from "@/components/ui/badge"

interface CCPIStatusBadgeProps {
  live: boolean
  source: string
}

export function CCPIStatusBadge({ live, source }: CCPIStatusBadgeProps) {
  if (live) {
    return (
      <Badge className="ml-2 bg-green-500 text-white text-xs flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-white"></span>
        Live
      </Badge>
    )
  }

  if (source.includes("baseline") || source.includes("fallback") || source.includes("historical")) {
    return (
      <Badge className="ml-2 bg-amber-500 text-white text-xs flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-white"></span>
        Baseline
      </Badge>
    )
  }

  return (
    <Badge className="ml-2 bg-red-500 text-white text-xs flex items-center gap-1">
      <span className="h-2 w-2 rounded-full bg-white"></span>
      Failed
    </Badge>
  )
}
