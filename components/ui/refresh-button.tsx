"use client"

import type React from "react"

import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RefreshButtonProps {
  onClick: () => void | Promise<void>
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
  isLoading = false,
  disabled = false,
  variant = "outline",
  size = "sm",
  className,
  showText = true,
  loadingText = "Refreshing...",
  children,
}: RefreshButtonProps) {
  const handleClick = async () => {
    await onClick()
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn("transition-all duration-200", isLoading && "cursor-wait", className)}
    >
      <RefreshCw className={cn("h-4 w-4", showText && "mr-2", isLoading && "animate-spin")} />
      {showText && <span>{children || (isLoading ? loadingText : "Refresh")}</span>}
    </Button>
  )
}
