import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// A 0–100 score in a KPI tile is `gradeText()` as the value and a ScoreRing in the tile's `visual`
// slot (the ring shows the number, so it is never printed twice).

/** Five stars for a 1–5 rating (rounded to whole stars); decorative next to the number. */
export function RatingStars({ rating, className }: { rating: number | null; className?: string }) {
  const filled = rating === null ? 0 : Math.round(Math.min(Math.max(rating, 0), 5));
  return (
    <span aria-hidden className={cn("inline-flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star key={index} className={cn("size-4", index < filled ? "fill-warning-bright text-warning" : "text-input")} />
      ))}
    </span>
  );
}
