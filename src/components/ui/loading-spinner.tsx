"use client"
import { cn } from "@/lib/utils"
import { LogoSpinner } from "@/components/common/logo-spinner"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number
  className?: string
  text?: string
}

export function LoadingSpinner({
  size = 48,
  className,
  text,
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4 min-h-[200px] w-full animate-in fade-in duration-300", className)}
      {...props}
    >
      <LogoSpinner size={size} />
      {text && (
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          {text}
        </p>
      )}
    </div>
  )
}