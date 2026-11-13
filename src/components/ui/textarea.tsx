import * as React from "react";

import { cn } from "@/lib/utils";

/** Multi-line text field with the same surface, border and focus treatment as Input. */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-base text-foreground shadow-xs transition-[border-color,box-shadow] outline-hidden placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
