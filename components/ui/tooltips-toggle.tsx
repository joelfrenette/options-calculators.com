"use client"

interface TooltipsToggleProps {
  enabled: boolean
  onChange?: (enabled: boolean) => void
  onToggle?: (enabled: boolean) => void
}

export function TooltipsToggle({ enabled, onChange, onToggle }: TooltipsToggleProps) {
  const handleToggle = onChange || onToggle

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Tooltips</span>
      <button
        onClick={() => handleToggle?.(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-emerald-600" : "bg-gray-300"
        }`}
        aria-label="Toggle tooltips"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )
}
