import type { ClientPageData } from "./types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Re-colours the app's design tokens with the agency's branding, so every component follows it. Text on the
 * primary colour turns dark when the colour is light. Also sets the tab title and icon.
 */
export function applyBranding(page: ClientPageData) {
  const root = document.documentElement.style;
  const primary = HEX.test(page.branding.primary_color) ? page.branding.primary_color : null;
  const secondary = HEX.test(page.branding.secondary_color) ? page.branding.secondary_color : null;
  if (primary) {
    const onPrimary = luminance(primary) > 0.45 ? "oklch(0.245 0.012 220)" : "oklch(0.985 0.002 220)";
    root.setProperty("--primary", primary);
    root.setProperty("--primary-foreground", onPrimary);
    root.setProperty("--ring", primary);
    root.setProperty("--chart-1", primary);
    root.setProperty("--brand-tint", `color-mix(in oklch, ${primary} 7%, white)`);
    root.setProperty("--brand-tint-strong", `color-mix(in oklch, ${primary} 15%, white)`);
    root.setProperty("--brand-soft", `color-mix(in oklch, ${primary} 70%, white)`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", primary);
  }
  if (secondary) {
    root.setProperty("--accent-2", secondary);
    root.setProperty("--chart-2", secondary);
  }

  document.title = `${page.location.name} · ${page.branding.name}`;
  if (page.branding.logo_url) {
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = page.branding.logo_url;
  }
}
