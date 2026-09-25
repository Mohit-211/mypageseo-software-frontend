import type { ReactNode } from "react";
import { AlertCircle, Check, Plus, X } from "lucide-react";
import { AuthLayout, AuthWordmark } from "@/components/mypageseo/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stepIndex, type OnboardingStep, type OnboardingStepId } from "@/lib/mypageseo/onboarding";
import { cn } from "@/lib/utils";

/** Focused setup frame — the authentication shell, not the app shell. */
export function OnboardingFrame({ children }: { children: ReactNode }) {
  return (
    <AuthLayout>
      <div className="w-full max-w-xl">
        <div className="lg:hidden">
          <AuthWordmark className="mb-6" />
        </div>
        {children}
      </div>
    </AuthLayout>
  );
}

export function StepProgress({
  current,
  steps,
  completed = [],
  onStepSelect,
}: {
  current: OnboardingStepId;
  steps: OnboardingStep[];
  /** Steps already finished — reachable again through the indicator. */
  completed?: OnboardingStepId[];
  onStepSelect?: (step: OnboardingStepId) => void;
}) {
  const index = stepIndex(current, steps);
  const step = steps[index];
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          Step {index + 1} of {steps.length} · {step?.label}
          {step?.optional ? " (optional)" : ""}
        </span>
        <span className="shrink-0">{Math.round(((index + 1) / steps.length) * 100)}%</span>
      </div>
      <ol className="mt-2 flex gap-1.5" aria-label="Setup progress">
        {steps.map((entry, position) => {
          const isCurrent = entry.id === current;
          const isDone = completed.includes(entry.id) && !isCurrent;
          const reachable = Boolean(onStepSelect) && isDone;
          return (
            <li key={entry.id} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!reachable}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${position + 1}: ${entry.label}${isDone ? " (completed)" : ""}`}
                onClick={reachable ? () => onStepSelect?.(entry.id) : undefined}
                className={cn(
                  "block h-1.5 w-full rounded-full transition-colors",
                  isCurrent ? "bg-primary" : isDone ? "bg-primary/55 hover:bg-primary" : "bg-border",
                  reachable ? "cursor-pointer" : "cursor-default",
                )}
              />
            </li>
          );
        })}
      </ol>
      <ol className="mt-2 hidden gap-4 text-xs sm:flex sm:flex-wrap" aria-hidden>
        {steps.map((entry, position) => {
          const isCurrent = entry.id === current;
          const isDone = completed.includes(entry.id) && !isCurrent;
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-1.5",
                isCurrent
                  ? "font-medium text-foreground"
                  : isDone
                    ? "text-foreground/70"
                    : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full border text-[10px] leading-none",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                      ? "border-primary/50 text-primary"
                      : "border-border",
                )}
              >
                {isDone ? <Check className="size-2.5" /> : position + 1}
              </span>
              {entry.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SummaryRow({
  label,
  value,
  missingLabel = "Not set",
  required = false,
}: {
  label: string;
  value: string | null;
  missingLabel?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-32 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 flex-1 break-words text-sm",
          value ? "text-foreground" : required ? "text-critical" : "text-muted-foreground",
        )}
      >
        {value || missingLabel}
      </dd>
    </div>
  );
}

/** Simple list-builder used for keywords and competitors. */
export function ChipStep({
  title,
  description,
  supported,
  unsupportedNote,
  placeholder,
  draft,
  onDraftChange,
  onAdd,
  error,
  items,
  onRemove,
  emptyNote,
}: {
  title: string;
  description: string;
  supported: boolean;
  unsupportedNote: string;
  placeholder: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  error: string | null;
  items: string[];
  onRemove: (value: string) => void;
  emptyNote: string;
}) {
  if (!supported) {
    return (
      <Alert>
        <AlertCircle aria-hidden />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{unsupportedNote}</AlertDescription>
      </Alert>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          aria-label={title}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus aria-hidden /> Add
        </Button>
      </div>
      {error ? <p className="mt-1.5 text-sm text-critical">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">{emptyNote}</p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                className="text-muted-foreground hover:text-critical"
                onClick={() => onRemove(item)}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
