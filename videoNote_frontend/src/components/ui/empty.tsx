import * as React from "react"
import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center gap-6 py-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  )
}

function EmptyMedia({
  className,
  variant = "icon",
  children,
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "icon" | "image"
}) {
  return (
    <div
      data-slot="empty-media"
      className={cn(
        "flex items-center justify-center",
        variant === "icon" && "text-muted-foreground",
        className
      )}
      {...props}
    >
      {variant === "icon" && (
        <div className="rounded-full bg-muted p-4 [&_svg]:size-8 [&_svg]:shrink-0">
          {children}
        </div>
      )}
      {variant === "image" && children}
    </div>
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-title"
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
}