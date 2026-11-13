import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { Link, type To } from "react-router-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { hasUsableSession } from "@/api";
import logoMarkUrl from "@/assets/logo-mark.png";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHeadingDocumentTitle } from "@/hooks/use-document-title";
import { getPostLoginPath } from "@/lib/auth/auth-session";
import { cn } from "@/lib/utils";

/**
 * Authentication-level UI for MyPageSEO: the sign-in landing page and every page
 * around it (sign up, password reset, email verification, invitations, staff
 * sign-in, onboarding). One layout: the brand panel on the left (a compact brand
 * header on phones) and the form card on the right, plus the field, selection,
 * validation and outcome patterns those forms share.
 */

/* ------------------------------------------------------------------ brand -- */

/**
 * The MyPageSEO logo: the hexagon mark and the wordmark, linking home. `inverse`
 * is for the deep-teal brand surfaces (white wordmark, the mark on a white tile).
 *
 * "Home" is where `/` would send the reader (the dashboard when signed in, else Sign in), linked
 * directly: `/` itself forwards by replacing the history entry, which would drop the page the
 * logo was clicked on from Back.
 */
export function AuthWordmark({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  const inverse = tone === "inverse";
  return (
    <Link
      to={hasUsableSession() ? getPostLoginPath(null) : "/login"}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg",
        // The usual teal focus ring disappears on the deep-teal panel.
        inverse && "focus-visible:outline-highlight",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center", inverse ? "size-9 rounded-[10px] bg-card shadow-xs" : "size-8")}
      >
        <img src={logoMarkUrl} alt="" width={160} height={143} className={inverse ? "h-[22px] w-auto" : "h-7 w-auto"} />
      </span>
      <span className={cn("text-lg font-semibold tracking-tight", inverse ? "text-brand-foreground" : "text-brand")}>
        MyPage<span className={inverse ? undefined : "text-brand-accent"}>SEO</span>
      </span>
    </Link>
  );
}

const VALUE_PROPS: { icon: LucideIcon; title: string; text: string; ai?: boolean }[] = [
  {
    icon: TrendingUp,
    title: "Rankings you can see on a map",
    text: "Track every keyword across a local search grid and spot who outranks you.",
  },
  {
    icon: Star,
    title: "Google Business Profile and reviews",
    text: "Audit your profile, keep your details right and never miss a review.",
  },
  {
    icon: Sparkles,
    title: "AI posts and replies, white-label reports",
    text: "Draft posts and review replies in seconds, and send branded reports to clients.",
    ai: true,
  },
];

/**
 * Decorative layers of the brand surfaces: a deepening gradient, two soft glows and a map-grid dot
 * texture. The aqua glow stays at 10% on the panel so aqua text over it keeps >= 4.5:1 (4.9:1 at
 * its brightest); the compact header has no aqua text, so its glow can be stronger.
 */
function BrandBackdrop({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand to-sidebar-deep" />
      <div
        className={cn(
          "absolute rounded-full blur-3xl",
          compact ? "-right-16 -top-24 size-56 bg-highlight/20" : "-right-48 -top-56 size-[36rem] bg-highlight/10",
        )}
      />
      {compact ? null : <div className="absolute -bottom-48 -left-32 size-[28rem] rounded-full bg-primary/35 blur-3xl" />}
      <div className="absolute inset-0 opacity-[0.13] [background-image:radial-gradient(var(--brand-foreground)_1px,transparent_1.5px)] [background-size:22px_22px] [mask-image:linear-gradient(160deg,black,transparent_70%)]" />
    </div>
  );
}

/** Example ranks on a 5 × 5 local search grid around the business (centre = the business). */
const GRID_RANKS = [
  [7, 4, 3, 4, 9],
  [4, 2, 1, 2, 5],
  [3, 1, 1, 1, 3],
  [5, 2, 1, 2, 4],
  [13, 6, 3, 5, 15],
];

function gridCellClass(rank: number): string {
  if (rank <= 3) return "bg-success text-success-foreground";
  if (rank <= 10) return "bg-warning-bright text-warning-bright-foreground";
  return "bg-critical text-critical-foreground";
}

/** A still of the product: one location's map rankings, rating and AI reply drafts. Illustration only. */
function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Example: a location's map rankings, its rating and review replies drafted with AI"
      className={cn("relative max-w-[31rem]", className)}
    >
      <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-brand-foreground/10" />
      <div className="relative rounded-2xl bg-card p-4 text-card-foreground shadow-elevated">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-primary">
            <MapPin className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Riverside Dental</p>
            <p className="truncate text-xs text-muted-foreground">Austin, TX · “dentist near me”</p>
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-success-surface px-2.5 py-1 text-xs font-semibold text-success">
            <TrendingUp className="size-3.5" />
            Up 3 places
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-5">
          <div className="rounded-xl bg-brand-tint p-2.5">
            <div className="grid grid-cols-5 gap-1.5">
              {GRID_RANKS.flatMap((row, r) =>
                row.map((rank, c) => (
                  <span
                    key={`${r}-${c}`}
                    className={cn(
                      "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums",
                      gridCellClass(rank),
                      r === 2 && c === 2 && "ring-2 ring-primary ring-offset-2 ring-offset-brand-tint",
                    )}
                  >
                    {rank}
                  </span>
                )),
              )}
            </div>
          </div>

          <dl className="min-w-0 space-y-3.5">
            <div>
              <dt className="text-xs text-muted-foreground">Average map rank</dt>
              <dd className="mt-0.5 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">2.8</span>
                <span className="text-xs font-semibold text-success">from 5.9</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Top 3 across the area</dt>
              <dd className="mt-1.5">
                <span className="block h-2 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full w-[72%] rounded-full bg-success" />
                </span>
                <span className="mt-1 block text-xs font-medium tabular-nums">72% of the grid</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Google rating</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                4.8
                <span className="flex text-warning-bright">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="size-3.5 fill-current" />
                  ))}
                </span>
                <span className="text-xs font-normal text-muted-foreground">126 reviews</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-xl bg-ai-surface px-3 py-2.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ai text-ai-foreground">
            <Sparkles className="size-4" />
          </span>
          <p className="min-w-0 text-xs font-medium text-foreground">Replies to 3 new reviews drafted with AI</p>
          <span className="ml-auto shrink-0 text-xs font-semibold text-ai">Review</span>
        </div>
      </div>
    </div>
  );
}

/** The left half on wide screens: logo, pitch, value props and (optionally) the product still. */
function BrandPanel({ showcase }: { showcase: boolean }) {
  return (
    <aside
      aria-label="About MyPageSEO"
      className="relative isolate hidden overflow-hidden text-brand-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col"
    >
      <BrandBackdrop />
      <div className="flex h-full flex-col overflow-y-auto px-10 py-8 [scrollbar-width:none] xl:px-16 [&::-webkit-scrollbar]:hidden">
        <AuthWordmark tone="inverse" className="self-start" />
        <div className="my-auto max-w-xl py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-highlight">
            Local SEO for businesses and agencies
          </p>
          <p className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-balance xl:text-[2.5rem]">
            Get found first when customers search nearby.
          </p>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-brand-foreground/85">
            Your rankings, Google Business Profile, reviews and reports in one place, for one location or hundreds.
          </p>
          <ul className="mt-6 space-y-3.5">
            {VALUE_PROPS.map(({ icon: Icon, title, text, ai }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-foreground/10 ring-1 ring-brand-foreground/15 ring-inset">
                  <Icon aria-hidden className={cn("size-5", ai ? "text-ai-bright" : "text-highlight")} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[15px] font-semibold leading-snug">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-brand-foreground/85">{text}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* The still only shows when the panel is tall enough to hold it without scrolling. */}
          {showcase ? <ProductPreview className="mt-7 hidden [@media(min-height:860px)]:block" /> : null}
        </div>
      </div>
    </aside>
  );
}

/** Phones and tablets: the brand panel shrinks to a header band above the form. */
function CompactBrandHeader() {
  return (
    <header className="relative isolate overflow-hidden px-4 py-4 text-brand-foreground sm:px-6 lg:hidden">
      <BrandBackdrop compact />
      <AuthWordmark tone="inverse" />
      <p className="mt-2 text-sm text-brand-foreground/85">Get found first when customers search nearby.</p>
    </header>
  );
}

/**
 * The layout of every auth page. `showcase` adds the product still to the brand
 * panel (sign in, sign up); `footer` sits under the form card (e.g. the staff
 * sign-in link on the login page).
 *
 * The browser tab is named after the card's heading ("Reset your password · MyPageSEO"),
 * following it as the page changes (a form that turns into "Check your email"); `title`
 * names it explicitly instead.
 */
export function AuthLayout({
  children,
  showcase = false,
  footer,
  title,
}: {
  children: ReactNode;
  showcase?: boolean;
  footer?: ReactNode;
  /** The tab's name, when it shouldn't follow the card's `<h1>`. */
  title?: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  useHeadingDocumentTitle(card, title);

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,8fr)_minmax(0,7fr)]">
      <CompactBrandHeader />
      <BrandPanel showcase={showcase} />
      <div className="flex flex-1 flex-col lg:min-h-dvh">
        <main className="flex flex-1 flex-col items-center px-4 py-6 sm:justify-center sm:px-6 sm:py-10 lg:px-10">
          <div ref={card} className="w-full max-w-[460px] rounded-2xl border border-border bg-card p-5 shadow-raised sm:p-8 lg:shadow-elevated">
            {children}
          </div>
        </main>
        {footer ? <div className="px-4 pb-6 text-center sm:pb-8">{footer}</div> : null}
      </div>
    </div>
  );
}

/** The sign-in landing page: the shared layout with the product still. */
export function LoginAuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <AuthLayout showcase footer={footer}>
      {children}
    </AuthLayout>
  );
}

/* ------------------------------------------------------------------- form -- */

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** A text link in auth copy ("Forgot password?", "Create an account"). */
export function AuthLink({ to, className, children }: { to: To; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-sm font-semibold text-primary underline-offset-4 hover:text-primary-hover hover:underline",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Lets the input inside an `AuthField` point at the field's error or hint (`aria-describedby`). */
const AuthFieldContext = createContext<{ describedBy: string | undefined } | null>(null);

/** Field wrapper: label, control, inline validation message. */
export function AuthField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** Shows a red asterisk after the label. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-critical">
            *
          </span>
        ) : null}
      </Label>
      <AuthFieldContext.Provider value={{ describedBy }}>{children}</AuthFieldContext.Provider>
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-xs font-medium text-critical">
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthInput({
  invalid,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { invalid?: boolean | undefined }) {
  const field = useContext(AuthFieldContext);
  return (
    <Input
      {...props}
      aria-invalid={invalid || undefined}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      // 16px text on phones (smaller makes iOS zoom into the field); the base Input steps down from md.
      className={cn("h-11 px-3.5", className)}
    />
  );
}

export function AuthPasswordInput({
  invalid,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { invalid?: boolean | undefined }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <AuthInput {...props} invalid={invalid} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors outline-hidden hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff aria-hidden className="size-[18px]" /> : <Eye aria-hidden className="size-[18px]" />}
      </button>
    </div>
  );
}

export type AuthOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  icon?: LucideIcon;
};

/** Selection cards (used for the account type): a radio group styled as cards. */
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
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-foreground">{legend}</legend>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;
          const Icon = option.icon;
          return (
            <label
              key={option.value}
              htmlFor={`${id}-${option.value}`}
              className={cn(
                "relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-[background-color,border-color,box-shadow]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                selected
                  ? "border-primary bg-brand-tint ring-1 ring-primary"
                  : "border-border-strong bg-card hover:border-primary/50 hover:bg-accent/60",
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
              <span className="flex items-center gap-2.5 pr-6">
                {Icon ? (
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg",
                      selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                ) : null}
                <span className={cn("text-sm font-semibold", selected ? "text-primary" : "text-foreground")}>
                  {option.label}
                </span>
              </span>
              <span className="block text-xs leading-snug text-muted-foreground">{option.description}</span>
              <span
                aria-hidden
                className={cn(
                  "absolute right-3.5 top-[1.3rem] size-4 rounded-full border bg-card",
                  selected ? "border-[5px] border-primary" : "border-input",
                )}
              />
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
      className="flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical-surface px-3.5 py-3 text-sm text-foreground"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function AuthFooterNote({ children }: { children: ReactNode }) {
  return <p className="mt-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export type AuthStateTone = "info" | "success" | "critical";

/**
 * Outcome panel for authentication support screens (link sent, password reset,
 * email verified, link invalid or expired). Its title is the page heading.
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
          "mx-auto grid size-12 place-items-center rounded-xl ring-1 ring-inset [&_svg]:size-6",
          tone === "success" && "bg-success-surface text-success ring-success/20",
          tone === "critical" && "bg-critical-surface text-critical ring-critical/20",
          tone === "info" && "bg-brand-tint text-primary ring-primary/20",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <div className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</div>
      {children ? <div className="mt-6 space-y-3 text-left">{children}</div> : null}
    </div>
  );
}
