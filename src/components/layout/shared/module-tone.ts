/**
 * Colour tones shared by the design system.
 *
 * - Module tones give each product area a recognisable colour (icon chips, page headers,
 *   overview tiles, empty states). Each tone is a soft tint with a coloured icon, never a
 *   solid block, so it reads as identity rather than status.
 * - Status tones carry meaning (good, attention, critical, info, AI) and always ship with a
 *   label or an icon, never colour alone.
 *
 * The class strings are written out in full on purpose: Tailwind only generates classes it
 * can find verbatim in the source.
 */

export type ModuleTone =
  | "brand"
  | "dashboard"
  | "locations"
  | "keywords"
  | "rankings"
  | "gbp"
  | "posts"
  | "reputation"
  | "citations"
  | "competitors"
  | "ai"
  | "reports"
  | "clients"
  | "settings"
  | "help";

export type ToneClasses = {
  /** Soft chip: white base, a diagonal tint, a hairline ring and the icon colour (icon >= 3:1 on it). */
  chip: string;
  /** Icon or mark colour on a white card. */
  icon: string;
  /** Solid fill for bars, dots and progress. */
  solid: string;
  /** A light wash of the tone, for hover rows and highlighted areas. */
  soft: string;
};

const PRIMARY: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-primary/12 to-primary/4 text-primary ring-1 ring-inset ring-primary/20",
  icon: "text-primary",
  solid: "bg-primary",
  soft: "bg-primary/8",
};

const BRAND: ToneClasses = {
  // The brand-tint surface (the "brand chips" token), not a wash of the deep teal: a /12 wash of
  // that low-chroma ink turns grey and looked like the neutral settings chip. Icon >= 9:1 on it.
  chip: "bg-card bg-linear-to-br from-brand-tint to-brand-tint/40 text-brand ring-1 ring-inset ring-brand/20",
  icon: "text-brand",
  solid: "bg-brand",
  soft: "bg-brand/8",
};

const BLUE: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-chart-3/12 to-chart-3/4 text-chart-3 ring-1 ring-inset ring-chart-3/20",
  icon: "text-chart-3",
  solid: "bg-chart-3",
  soft: "bg-chart-3/8",
};

const TEAL: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-chart-1/12 to-chart-1/4 text-chart-1 ring-1 ring-inset ring-chart-1/25",
  icon: "text-chart-1",
  solid: "bg-chart-1",
  soft: "bg-chart-1/8",
};

const ORANGE: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-chart-2/12 to-chart-2/4 text-chart-2 ring-1 ring-inset ring-chart-2/25",
  icon: "text-chart-2",
  solid: "bg-chart-2",
  soft: "bg-chart-2/8",
};

const OCHRE: ToneClasses = {
  // chart-7 itself is too light for an icon on its own tint, so the icon uses the darker ochre ink.
  chip: "bg-card bg-linear-to-br from-chart-7/14 to-chart-7/5 text-chart-7-ink ring-1 ring-inset ring-chart-7/30",
  icon: "text-chart-7-ink",
  solid: "bg-chart-7",
  soft: "bg-chart-7/10",
};

const GREEN: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-chart-4/12 to-chart-4/4 text-chart-4 ring-1 ring-inset ring-chart-4/25",
  icon: "text-chart-4",
  solid: "bg-chart-4",
  soft: "bg-chart-4/8",
};

const MAGENTA: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-chart-8/12 to-chart-8/4 text-chart-8 ring-1 ring-inset ring-chart-8/20",
  icon: "text-chart-8",
  solid: "bg-chart-8",
  soft: "bg-chart-8/8",
};

const VIOLET: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-ai/12 to-ai/4 text-ai ring-1 ring-inset ring-ai/20",
  icon: "text-ai",
  solid: "bg-ai",
  soft: "bg-ai/8",
};

const NEUTRAL: ToneClasses = {
  chip: "bg-card bg-linear-to-br from-muted-foreground/12 to-muted-foreground/4 text-muted-foreground ring-1 ring-inset ring-border-strong",
  icon: "text-muted-foreground",
  solid: "bg-muted-foreground",
  soft: "bg-muted",
};

/** Module colours (SPEC 4.2). Overview pages, the sidebar sections and empty states share them. */
export const MODULE_TONE_CLASSES: Record<ModuleTone, ToneClasses> = {
  brand: BRAND,
  dashboard: PRIMARY,
  locations: PRIMARY,
  keywords: BLUE,
  rankings: TEAL,
  gbp: ORANGE,
  posts: ORANGE,
  reputation: OCHRE,
  citations: GREEN,
  competitors: MAGENTA,
  ai: VIOLET,
  reports: BRAND,
  clients: PRIMARY,
  settings: NEUTRAL,
  help: NEUTRAL,
};

/* -------------------------------------------------------------------------- */
/* Status tones                                                                */
/* -------------------------------------------------------------------------- */

export type StatusTone = "neutral" | "success" | "warning" | "critical" | "info" | "brand" | "ai";

export type StatusToneClasses = {
  /** Soft badge: tinted surface, coloured text (>= 4.5:1) and a hairline border. */
  badge: string;
  /** Status dot or small mark on a white card (>= 3:1). */
  dot: string;
  /** Icon or number in the status colour on a white card. */
  text: string;
  /** Soft surface for notices and highlighted rows. */
  surface: string;
  /** Icon chip: tinted surface plus coloured icon. */
  chip: string;
};

export const STATUS_TONE_CLASSES: Record<StatusTone, StatusToneClasses> = {
  neutral: {
    badge: "border-border-strong/70 bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    surface: "bg-muted",
    chip: "bg-muted text-muted-foreground",
  },
  success: {
    badge: "border-success/25 bg-success-surface text-success",
    dot: "bg-success",
    text: "text-success",
    surface: "bg-success-surface",
    chip: "bg-success-surface text-success",
  },
  warning: {
    badge: "border-warning/35 bg-warning-surface text-warning-foreground",
    dot: "bg-warning",
    text: "text-warning-foreground",
    surface: "bg-warning-surface",
    chip: "bg-warning-surface text-warning",
  },
  critical: {
    badge: "border-critical/25 bg-critical-surface text-critical",
    dot: "bg-critical",
    text: "text-critical",
    surface: "bg-critical-surface",
    chip: "bg-critical-surface text-critical",
  },
  info: {
    badge: "border-info/25 bg-info-surface text-info",
    dot: "bg-info",
    text: "text-info",
    surface: "bg-info-surface",
    chip: "bg-info-surface text-info",
  },
  brand: {
    badge: "border-primary/20 bg-brand-tint text-primary",
    dot: "bg-primary",
    text: "text-primary",
    surface: "bg-brand-tint",
    chip: "bg-brand-tint text-primary",
  },
  ai: {
    badge: "border-ai/25 bg-ai-surface text-ai",
    dot: "bg-ai",
    text: "text-ai",
    surface: "bg-ai-surface",
    chip: "bg-ai-surface text-ai",
  },
};
