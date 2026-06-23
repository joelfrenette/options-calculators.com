"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "group relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={
          "bg-muted relative grow overflow-hidden rounded-full border border-border/60 transition-all data-[orientation=horizontal]:h-3 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-3"
        }
      >
        {/* Tick notches so the bar reads clearly as an adjustable slider */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 data-[orientation=vertical]:hidden"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, color-mix(in oklch, var(--color-foreground) 25%, transparent) 0 1px, transparent 1px calc(100% / 20))",
            backgroundPosition: "center",
          }}
        />
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full transition-all"
          }
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-primary ring-primary/30 flex h-6 w-6 shrink-0 items-center justify-center gap-[2px] rounded-full border-2 bg-white shadow-md transition-all hover:ring-8 hover:shadow-lg focus-visible:ring-8 focus-visible:shadow-lg focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 cursor-grab active:cursor-grabbing active:ring-8"
        >
          {/* Grip lines signal that the handle is draggable */}
          <span aria-hidden="true" className="h-2.5 w-[2px] rounded-full bg-primary/70" />
          <span aria-hidden="true" className="h-2.5 w-[2px] rounded-full bg-primary/70" />
          <span aria-hidden="true" className="h-2.5 w-[2px] rounded-full bg-primary/70" />
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
