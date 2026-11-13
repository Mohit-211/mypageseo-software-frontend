import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { cn } from "@/lib/utils";

/**
 * A section heading of the White Label page: the step number (matching the setup strip at the
 * top) or, outside the steps, the shared section header with an icon.
 */
export function StepHeading({
  step,
  icon,
  title,
  description,
  actions,
  className,
}: {
  step?: number | undefined;
  icon?: LucideIcon | undefined;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  if (!step) {
    return <SectionHeader title={title} description={description} actions={actions} {...(icon ? { icon, tone: "brand" as const } : {})} className={className} />;
  }
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden className="mt-px grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground shadow-xs">
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            <span className="sr-only">Step {step}: </span>
            {title}
          </h2>
          {description ? <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
