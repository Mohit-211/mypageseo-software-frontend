import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASSES } from "@/components/layout/shared/module-tone";

/**
 * Badges label things; they are not buttons, so they have no hover or focus state.
 * Soft tones (success, warning, critical, info, ai, brand, neutral) are the default choice:
 * a tinted surface with coloured text at >= 4.5:1. Solid `default` / `destructive` are for rare,
 * high-emphasis counts.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border-strong bg-card text-foreground",
        success: STATUS_TONE_CLASSES.success.badge,
        warning: STATUS_TONE_CLASSES.warning.badge,
        critical: STATUS_TONE_CLASSES.critical.badge,
        info: STATUS_TONE_CLASSES.info.badge,
        ai: STATUS_TONE_CLASSES.ai.badge,
        brand: STATUS_TONE_CLASSES.brand.badge,
        neutral: STATUS_TONE_CLASSES.neutral.badge,
      },
      size: {
        sm: "px-1.5 py-px text-xs [&_svg]:size-3",
        md: "px-2 py-0.5 text-xs [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
