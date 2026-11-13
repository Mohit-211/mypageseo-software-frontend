import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

/**
 * A 1–5 star rating: filled stars in bright amber with a darker outline, empty ones in the input
 * grey (both >= 3:1 on white). `value` may be fractional (an average): a star at least half full
 * counts as filled. The label gives the exact number to screen readers.
 */
export function ReviewStars({
  value,
  size = "sm",
  className,
  label,
}: {
  value: number | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
  /** Screen-reader text; defaults to "4 out of 5 stars". */
  label?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={label ?? `${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`} className={cn("inline-flex shrink-0 items-center gap-px", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          strokeWidth={1.75}
          className={cn(SIZE[size], star <= filled ? "fill-warning-bright text-warning" : "fill-card text-input")}
        />
      ))}
    </span>
  );
}
