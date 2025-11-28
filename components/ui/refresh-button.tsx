"use client"

import type React from "react"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RefreshButtonProps {
  onClick?: () => void | Promise<void>
  onRefresh?: () => void | Promise<void>
  loading?: boolean
  isLoading?: boolean
  disabled?: boolean
  variant?: "default" | "outline" | "ghost" | "secondary"
  size?: "default" | "sm" | "lg" | "icon"
  className?: string
  showText?: boolean
  loadingText?: string
  children?: React.ReactNode
}

export function RefreshButton({
  onClick,
  onRefresh,
  loading = false,
  isLoading = false,
  disabled = false,
  variant = "default",
  size = "sm",
  className,
  showText = true,
  loadingText = "Refreshing...",
  children,
}: RefreshButtonProps) {
  const handleClick = async () => {
    const handler = onClick || onRefresh
    if (handler) {
      await handler()
    }
  }

  const isButtonLoading = loading || isLoading

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isButtonLoading}
      className={cn(
        "bg-emerald-600 hover:bg-emerald-700 text-white border-0 transition-all duration-200",
        isButtonLoading && "cursor-wait",
        className,
      )}
    >
      <RefreshCw className={cn("h-4 w-4", showText && "mr-2", isButtonLoading && "animate-spin")} />
      {showText && <span>{children || (isButtonLoading ? loadingText : "Refresh")}</span>}
    </Button>
  )
}
