import type { CSSProperties } from "react";
import { toast } from "sonner";
import { BRAND_FONT_FAMILY, BUTTON_STYLE_RADIUS, readableTextColor, type ReportTheme } from "@/lib/white-label/white-label";

/** CSS variables every branded surface reads, so colours update live as settings change. */
export function themeStyle(theme: ReportTheme): CSSProperties {
  return {
    "--wl-primary": theme.primaryColor,
    "--wl-primary-fg": readableTextColor(theme.primaryColor),
    "--wl-secondary": theme.secondaryColor,
    "--wl-secondary-fg": readableTextColor(theme.secondaryColor),
    "--wl-accent": theme.accentColor,
    "--wl-accent-fg": readableTextColor(theme.accentColor),
    "--wl-radius": BUTTON_STYLE_RADIUS[theme.buttonStyle],
    fontFamily: BRAND_FONT_FAMILY[theme.font],
  } as CSSProperties;
}

export const brandedButton = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-(--wl-radius) bg-(--wl-primary) px-3.5 py-2 text-sm font-medium text-(--wl-primary-fg) shadow-sm",
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-(--wl-radius) border border-black/10 bg-(--wl-secondary) px-3.5 py-2 text-sm font-medium text-(--wl-secondary-fg)",
};

/** Copies text and confirms with a toast. Falls back to a hidden textarea where the Clipboard API is blocked. */
export async function copyText(text: string, message = "Copied to clipboard.") {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast.success(message);
  } catch {
    toast.error("Couldn't copy automatically.", { description: text });
  }
}
