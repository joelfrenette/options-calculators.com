"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Check } from "lucide-react"

interface DataLoadGateProps {
  /** Heading shown in the prompt. */
  title?: string
  /** Supporting line describing what will be fetched. */
  description?: string
  /** Called when the user chooses to load data. */
  onConfirm: () => void
}

/**
 * A simple gate shown before a tab fetches any data.
 * Nothing is requested from APIs until the user explicitly clicks "Yes".
 * If the user clicks "No", the prompt collapses to a small inline button so
 * they can still load later without being nagged.
 */
export function DataLoadGate({
  title = "Load New Data?",
  description = "This tab does not load automatically so you can navigate freely without triggering API calls. Load the latest data now?",
  onConfirm,
}: DataLoadGateProps) {
  const [declined, setDeclined] = useState(false)

  if (declined) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
        <span className="text-sm text-gray-500">Data not loaded.</span>
        <Button size="sm" onClick={onConfirm} className="gap-1.5">
          <Database className="h-3.5 w-3.5" />
          Load Data
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[320px] w-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-balance text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-gray-500">{description}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button size="lg" onClick={onConfirm} className="gap-2">
            <Check className="h-4 w-4" />
            Yes, Load Data
          </Button>
          <Button size="lg" variant="outline" onClick={() => setDeclined(true)}>
            No
          </Button>
        </div>
      </div>
    </div>
  )
}
