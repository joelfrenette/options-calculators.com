# CCPI Reusable Components

This directory contains reusable UI components for the CCPI dashboard system.

## Components

### `CCPIGradientBar`
Displays a horizontal gradient bar from green (low risk) to red (high risk).

**Props:**
- `value` - Current value to display on bar
- `min` - Minimum value (default: 0)
- `max` - Maximum value (default: 100)
- `reverse` - Reverse the bar direction (default: false)
- `className` - Additional CSS classes

**Usage:**
\`\`\`tsx
<CCPIGradientBar value={75} min={0} max={100} />
\`\`\`

---

### `CCPIIndicator`
Complete indicator display with label, value, gradient bar, and optional tooltip.

**Props:**
- `label` - Indicator name/description
- `value` - Current value (number or string)
- `thresholds` - Low/mid/high threshold definitions with labels
- `tooltipContent` - Optional tooltip explanation
- `formatValue` - Optional value formatting function
- `valueColor` - Optional CSS class for value color
- `barMin/barMax/barReverse` - Gradient bar configuration
- `tooltipsEnabled` - Show/hide tooltip (default: true)

**Usage:**
\`\`\`tsx
<CCPIIndicator
  label="VIX (Fear Index)"
  value={28.5}
  thresholds={{
    low: { value: 0, label: "Calm: <15" },
    mid: { value: 20, label: "Elevated: 15-30" },
    high: { value: 30, label: "Fear: >30" }
  }}
  tooltipContent={
    <CCPIIndicatorTooltip
      title="VIX Fear Index"
      description="Measures expected market volatility"
      thresholds={[...]}
      impact="High VIX indicates market fear"
    />
  }
/>
\`\`\`

---

### `CCPIBooleanIndicator`
Specialized indicator for YES/NO values (e.g., "Below SMA20").

**Props:**
- `label` - Indicator name
- `value` - Boolean value
- `proximity` - Percentage (0-100) for bar display
- `thresholds` - Threshold labels for bar
- `tooltipContent` - Optional tooltip
- `additionalInfo` - Optional extra text (e.g., "75% proximity")

**Usage:**
\`\`\`tsx
<CCPIBooleanIndicator
  label="QQQ Below 200-Day SMA"
  value={false}
  proximity={25}
  additionalInfo="25% proximity"
  thresholds={{
    low: { value: 0, label: "Safe: 0%" },
    mid: { value: 50, label: "Warning: 50%" },
    high: { value: 100, label: "Danger: 100%" }
  }}
/>
\`\`\`

---

### `CCPIStatusBadge`
Shows API data source status (Live/Baseline/Failed).

**Props:**
- `live` - Whether data is live
- `source` - Source description string

**Usage:**
\`\`\`tsx
<CCPIStatusBadge live={true} source="API" />
\`\`\`

---

### `CCPICanaryCard`
Displays a warning canary with severity-based styling.

**Props:**
- `canary` - Canary object from CCPI data
- `tooltipsEnabled` - Show/hide tooltip

**Usage:**
\`\`\`tsx
{canaries.map((canary) => (
  <CCPICanaryCard key={canary.signal} canary={canary} />
))}
\`\`\`

## Benefits

1. **DRY Principle** - Eliminates 34+ duplicated indicator blocks
2. **Consistency** - All indicators have identical styling and behavior
3. **Maintainability** - Update once, changes apply everywhere
4. **Type Safety** - Full TypeScript support with proper interfaces
5. **Accessibility** - Consistent ARIA labels and keyboard navigation
6. **Testability** - Each component can be tested in isolation

## Migration

To migrate existing indicators to use these components:

**Before:**
\`\`\`tsx
<div className="space-y-2">
  <div className="flex items-center justify-between text-sm">
    <span className="font-medium">VIX</span>
    <span className="font-bold">{data.vix}</span>
  </div>
  <div className="relative w-full h-3 rounded-full overflow-hidden">
    {/* gradient bar code */}
  </div>
  <div className="flex justify-between text-xs text-gray-600">
    {/* threshold labels */}
  </div>
</div>
\`\`\`

**After:**
\`\`\`tsx
<CCPIIndicator
  label="VIX (Fear Index)"
  value={data.vix}
  thresholds={{ ... }}
/>
\`\`\`

**Result:** ~30 lines → 5 lines (83% reduction)
\`\`\`
