import { RefreshCw } from "lucide-react"

interface LoadingSpinnerProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ message = "Loading data...", size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  }

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  }

  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <RefreshCw className={`${sizeClasses[size]} animate-spin text-primary`} />
      <span className={`ml-3 ${textSizeClasses[size]} text-gray-600`}>{message}</span>
    </div>
  )
}
