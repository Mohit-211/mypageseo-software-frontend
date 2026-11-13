import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * One focus treatment for every variant: a 2px ring in the primary teal with a 2px gap, so it
 * stays visible even around a teal-filled button. Hovers darken (never lighten) the fill, so
 * white text keeps >= 4.5:1.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover",
        outline:
          "border border-border-strong bg-card text-foreground shadow-xs hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
        /** Tonal teal: quieter than default, still visible on the canvas (a grey fill would vanish there). */
        secondary: "bg-brand-tint text-primary-hover hover:bg-brand-tint-strong",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:text-primary-hover hover:underline",
        /** Brand red. Rare: destructive-adjacent emphasis only. */
        accent: "bg-brand-accent text-brand-accent-foreground shadow-xs hover:bg-destructive-hover",
        "accent-outline":
          "border border-critical/30 bg-critical-surface text-critical shadow-xs hover:border-critical/55",
        /** AI actions ("Write with AI", "Draft replies with AI"): the AI violet. */
        ai: "bg-ai text-ai-foreground shadow-xs hover:bg-ai-hover",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9",
      },
    },
    compoundVariants: [
      {
        /**
         * Touch screens: at least 36×36px (the app's minimum tap target), whatever the size or a
         * caller's compact override (`h-7`, `size-8`). A min-height, so mouse layouts keep their
         * density. Not for `link`: those sit inline in sentences, where a taller box would break the line.
         */
        variant: ["default", "destructive", "outline", "secondary", "ghost", "accent", "accent-outline", "ai"],
        className: "pointer-coarse:min-h-9 pointer-coarse:min-w-9",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
