import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowDown, Eye, EyeOff, MapPin, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Authentication-level UI for Mypageseo.
 * These primitives are the canonical field, selection, validation and layout
 * patterns for /login, /signup and later onboarding and account screens.
 */

export function AuthWordmark({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
        M
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">Mypageseo</span>
    </Link>
  );
}

/** Balanced brand + form composition on desktop, single column on mobile. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 gap-8 px-5 py-8 md:gap-12 md:px-8 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
        <aside className="flex flex-col lg:justify-center lg:py-8">
          <AuthWordmark />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground lg:mt-8 lg:text-base">
            Mypageseo helps businesses and agencies manage local search performance — Google
            Business Profiles, local rankings, citations, competitors and client-ready reporting in
            one workspace.
          </p>
          <ul className="mt-5 hidden max-w-md space-y-2 text-sm text-muted-foreground lg:block">
            <li className="border-l-2 border-border pl-3">
              Track local and map rankings across every location.
            </li>
            <li className="border-l-2 border-border pl-3">
              Monitor Google Business Profile health, reviews and posts.
            </li>
            <li className="border-l-2 border-border pl-3">
              Produce client-ready reports from the same underlying data.
            </li>
          </ul>
        </aside>

        <main className="flex items-start lg:items-center">
          <div className="w-full rounded-lg border border-border bg-surface p-5 shadow-card sm:p-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Product-led login composition. Other auth routes retain the compact shared layout. */
export function LoginAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-5 sm:px-6 sm:py-8 lg:grid lg:place-items-center lg:py-10">
      <div className="mx-auto grid w-full max-w-[1060px] overflow-hidden rounded-lg border border-border bg-surface shadow-elevated lg:min-h-[680px] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <aside className="flex min-w-0 flex-col bg-primary px-6 py-7 text-primary-foreground sm:px-9 sm:py-9 lg:px-12 lg:py-11">
          <AuthWordmark className="[&_span:first-child]:bg-primary-foreground [&_span:first-child]:text-primary [&_span:last-child]:text-primary-foreground" />

          <div className="mt-10 max-w-lg lg:mt-16">
            <p className="text-xs font-medium uppercase text-primary-foreground/85">Local search operations</p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-primary-foreground sm:text-4xl">
              Local SEO, without the guesswork.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-primary-foreground/75 sm:text-base">
              Bring local rankings, Google Business Profile insights, citations, competitors and
              reporting together in one focused platform.
            </p>
          </div>

          <AuthProductPreview />
        </aside>

        <main className="flex min-w-0 items-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[370px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function AuthProductPreview() {
  return (
    <div className="mt-8 border border-primary-foreground/15 bg-primary-foreground/5 lg:mt-auto">
      <div className="flex items-center justify-between border-b border-primary-foreground/15 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-primary-foreground">Austin · North location</p>
          <p className="mt-0.5 text-[11px] text-primary-foreground/80">Last 28 days</p>
        </div>
        <span className="flex items-center gap-1 text-xs text-success-surface">
          <TrendingUp className="size-3.5" aria-hidden /> 8.4%
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-primary-foreground/15 border-b border-primary-foreground/15">
        <PreviewMetric label="Visibility" value="72%" />
        <PreviewMetric label="Avg. rank" value="8.6" />
        <PreviewMetric label="GBP health" value="84" />
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div>
          <div className="flex items-center justify-between text-[11px] text-primary-foreground/80">
            <span>Ranking movement</span>
            <span>4 weeks</span>
          </div>
          <div
            role="img"
            aria-label="Ranking trend improving over four weeks"
            className="mt-4 flex h-16 items-end gap-1.5"
          >
            {["h-5", "h-7", "h-6", "h-8", "h-7", "h-10", "h-9", "h-11", "h-10", "h-12", "h-11", "h-14"].map((height, index) => (
              <span
                key={`${height}-${index}`}
                className={cn("min-w-0 flex-1 bg-primary-foreground/25", height)}
              />
            ))}
          </div>
        </div>
        <div className="border-t border-primary-foreground/15 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-[11px] text-primary-foreground/80">Next action</p>
          <div className="mt-2 flex gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary-foreground/70" aria-hidden />
            <p className="text-xs leading-5 text-primary-foreground/85">
              Update hours on one location
            </p>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-primary-foreground/80">
            <ArrowDown className="size-3" aria-hidden /> 3 keywords declined
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3.5">
      <p className="text-[10px] text-primary-foreground/80 sm:text-[11px]">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium text-primary-foreground">{value}</p>
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-lg font-semibold text-foreground sm:text-xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/** Field wrapper: label, control, inline validation message. */
export function AuthField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-critical">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function AuthInput({
  invalid,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { invalid?: boolean | undefined }) {
  return (
    <Input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 bg-background text-sm",
        invalid && "border-critical focus-visible:ring-critical/30",
        className,
      )}
    />
  );
}

export function AuthPasswordInput({
  invalid,
  ...props
}: React.ComponentProps<typeof Input> & { invalid?: boolean | undefined }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthInput
        {...props}
        {...(invalid === undefined ? {} : { invalid })}
        type={visible ? "text" : "password"}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export type AuthOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

/** Compact segmented selection control (used for account type). */
export function AuthOptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  name,
}: {
  legend: string;
  options: AuthOption<T>[];
  value: T;
  onChange: (value: T) => void;
  name: string;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-foreground">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className={cn(
                "cursor-pointer rounded-md border p-3 transition-colors",
                selected
                  ? "border-primary bg-accent/60 ring-1 ring-primary"
                  : "border-border bg-background hover:border-input hover:bg-secondary/60",
              )}
            >
              <input
                id={`${id}-${option.value}`}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "block text-sm font-semibold",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** General (non field-level) form error, e.g. a failed submission. */
export function AuthFormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-critical/25 bg-critical-surface px-3 py-2.5 text-sm text-foreground"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function AuthFooterNote({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-center text-sm text-muted-foreground">{children}</p>;
}

export type AuthStateTone = "info" | "success" | "critical";

/**
 * Outcome panel for authentication support screens (link sent, password reset,
 * email verified, link invalid or expired).
 */
export function AuthStatePanel({
  tone = "info",
  icon,
  title,
  description,
  children,
}: {
  tone?: AuthStateTone;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div role="status" className="text-center">
      <span
        className={cn(
          "mx-auto grid size-10 place-items-center rounded-md border",
          tone === "success" && "border-success/30 bg-success-surface text-success",
          tone === "critical" && "border-critical/25 bg-critical-surface text-critical",
          tone === "info" && "border-border bg-secondary text-primary",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <h2 className="mt-3.5 text-base font-semibold text-foreground sm:text-lg">{title}</h2>
      <div className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
        {description}
      </div>
      {children ? <div className="mt-5 space-y-2.5 text-left">{children}</div> : null}
    </div>
  );
}
