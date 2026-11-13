import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The location setup wizard's steps: numbered circles joined by a line (done steps get a check,
 * the current one is filled), and on phones a compact "Step 2 of 4" with a progress bar. Earlier
 * steps can be revisited; later ones open in order.
 */
export function SetupStepper({
  steps,
  current,
  complete,
  onSelect,
}: {
  steps: readonly { id: string; label: string }[];
  /** Index of the current step (`steps.length` when setup is complete). */
  current: number;
  complete: boolean;
  onSelect: (index: number) => void;
}) {
  const shown = Math.min(current, steps.length - 1);
  const progress = complete ? 1 : (current + 0.5) / steps.length;
  return (
    <nav aria-label="Setup steps" className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-card sm:px-5 sm:py-4">
      <div className="sm:hidden">
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-semibold text-foreground">{complete ? "Setup complete" : steps[shown]?.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {complete ? `${steps.length} of ${steps.length}` : `Step ${shown + 1} of ${steps.length}`}
          </span>
        </p>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <ol className="hidden items-center sm:flex">
        {steps.map((step, index) => {
          const done = complete || index < current;
          const active = !complete && index === current;
          return (
            <li key={step.id} className={cn("flex items-center", index < steps.length - 1 && "flex-1")}>
              <button
                type="button"
                disabled={index > current || complete}
                onClick={() => onSelect(index)}
                aria-current={active ? "step" : undefined}
                className="group flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg pr-2 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums transition-colors",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : active
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_var(--color-brand-tint)]"
                        : "border-border-strong bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : index + 1}
                </span>
                <span className={cn("text-sm", active ? "font-semibold text-foreground" : done ? "font-medium text-foreground group-hover:text-primary" : "text-muted-foreground")}>
                  {step.label}
                  {done ? <span className="sr-only"> (done)</span> : null}
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span aria-hidden className={cn("mx-2 h-0.5 min-w-6 flex-1 rounded-full", done ? "bg-success" : "bg-border")} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
