import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        present: "border-transparent bg-[hsl(var(--present-light))] text-[hsl(var(--present))]",
        absent: "border-transparent bg-[hsl(var(--absent-light))] text-[hsl(var(--absent))]",
        done: "border-transparent bg-[hsl(var(--done-light))] text-[hsl(var(--done))]",
        late: "border-transparent bg-[hsl(var(--status-late-bg))] text-[hsl(var(--status-late))]",
        pending: "border-transparent bg-status-pending-bg text-status-pending",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
