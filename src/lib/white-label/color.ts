import { HEX } from "./branding";

/**
 * Colour maths for the brand editor: WCAG contrast, and how each place that shows the brand puts
 * text on its colours, so the live preview and the contrast pills match what clients will see.
 *
 * - PDF reports and report emails print the agency name, contact line and table headers in white
 *   on the primary colour, and the client's business name in the secondary colour on white
 *   (backend `render/pdf.service.ts` and `render/html.service.ts`). Neither adapts the text colour.
 * - The client page picks dark or light text on the primary colour by its luminance
 *   (`src/client-page/theme.ts`), so it stays readable whatever the colour.
 */

/** MyPageSEO's own colours: what reports use until an agency picks its own. */
export const DEFAULT_PRIMARY = "#1d4ed8";
export const DEFAULT_SECONDARY = "#0f766e";

/** White: the text the PDF and the email print on the primary colour, and the PDF page colour. */
export const PDF_WHITE = "#ffffff";

/** The client page's two text colours on the primary colour (copied from `src/client-page/theme.ts`). */
const CLIENT_PAGE_DARK_TEXT = "oklch(0.245 0.012 220)";
const CLIENT_PAGE_LIGHT_TEXT = "oklch(0.985 0.002 220)";

/** A usable `#rrggbb` (lower case), or the fallback. */
export function hexOr(value: string | null | undefined, fallback: string): string {
  return value && HEX.test(value) ? value.toLowerCase() : fallback;
}

/** Relative luminance of a `#rrggbb` colour (WCAG 2). */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The text colour the client page uses on this primary colour. */
export function clientPageTextOn(primary: string): string {
  return luminance(primary) > 0.45 ? CLIENT_PAGE_DARK_TEXT : CLIENT_PAGE_LIGHT_TEXT;
}

/**
 * The client page's hero: the primary colour with a little depth and a glow of the secondary
 * colour, as `src/client-page/client.css` (.hero-3d) draws it.
 */
export function clientHeroBackground(primary: string, secondary: string): string {
  return [
    "radial-gradient(260px 120px at 0% 0%, rgb(255 255 255 / 0.22), transparent 70%)",
    `radial-gradient(240px 150px at 100% 120%, color-mix(in oklch, ${secondary} 55%, transparent), transparent 70%)`,
    `linear-gradient(135deg, color-mix(in oklch, ${primary} 88%, white) 0%, ${primary} 45%, color-mix(in oklch, ${primary} 70%, black) 100%)`,
  ].join(", ");
}

/** A soft wash of a brand colour (the client page's tinted surfaces). */
export function brandWash(color: string, percent = 10): string {
  return `color-mix(in oklch, ${color} ${percent}%, white)`;
}

export type ContrastLevel = "good" | "large" | "poor";

/** ≥ 4.5 reads well at any size; 3 to 4.5 only for large or bold text; below 3 is hard to read. */
export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return "good";
  if (ratio >= 3) return "large";
  return "poor";
}

export type BrandContrast = {
  /** White text on the primary colour (PDF and email header band, PDF table headers). */
  primary: { ratio: number; level: ContrastLevel };
  /** The secondary colour as text on white (the client's business name on PDFs and emails). */
  secondary: { ratio: number; level: ContrastLevel };
};

/** How readable the brand's text is where it is printed on or in its colours. */
export function brandContrast(primary: string, secondary: string): BrandContrast {
  const p = contrastRatio(PDF_WHITE, hexOr(primary, DEFAULT_PRIMARY));
  const s = contrastRatio(hexOr(secondary, DEFAULT_SECONDARY), PDF_WHITE);
  return {
    primary: { ratio: p, level: contrastLevel(p) },
    secondary: { ratio: s, level: contrastLevel(s) },
  };
}

/** "4.8:1", for tooltips. */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}:1`;
}
