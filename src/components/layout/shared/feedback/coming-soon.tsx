import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import type { ModuleTone } from "@/components/layout/shared/module-tone";

/**
 * A feature that is planned but has no backend yet. Shows what it will do and
 * nothing else: no sample data, no controls. The list of planned features is
 * kept in docs/PIPELINE.md. `tone="ai"` gives AI features their violet look.
 */
export function ComingSoon({
  title,
  description,
  icon,
  tone,
  className,
}: {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: ModuleTone;
  className?: string;
}) {
  return (
    <EmptyState
      variant="coming-soon"
      title={title}
      description={description}
      {...(icon ? { icon } : {})}
      {...(tone ? { tone } : {})}
      className={cn("py-14", className)}
    />
  );
}
