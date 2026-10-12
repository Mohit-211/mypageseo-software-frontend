import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A feature that is planned but has no backend yet. Shows what it will do and
 * nothing else: no sample data, no controls. The list of planned features is
 * kept in docs/PIPELINE.md.
 */
export function ComingSoon({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-primary/25 bg-brand-tint px-6 py-14 text-center",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-background px-2.5 py-0.5 text-xs font-medium text-primary">
        <Clock className="size-3.5" aria-hidden /> Coming soon
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
