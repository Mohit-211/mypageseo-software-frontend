import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Text input on a white surface (never the canvas colour, which reads as disabled). The border is
 * --input (>= 3:1 on the card and the canvas); focus turns it teal with a soft halo.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base text-foreground shadow-xs transition-[border-color,box-shadow] outline-hidden file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
