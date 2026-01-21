import * as React from "react"
import { cn } from "@/lib/utils"

const CyberCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "success" | "danger" }
>(({ className, variant = "default", ...props }, ref) => {
  const variantStyles = {
    default: "border-border/50 shadow-primary/5 hover:border-primary/50",
    success: "border-primary/50 shadow-primary/20 bg-primary/5 hover:border-primary",
    danger: "border-destructive/50 shadow-destructive/20 bg-destructive/5 hover:border-destructive",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-sm border bg-card text-card-foreground shadow-sm transition-all duration-300",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  )
})
CyberCard.displayName = "CyberCard"

export { CyberCard }
