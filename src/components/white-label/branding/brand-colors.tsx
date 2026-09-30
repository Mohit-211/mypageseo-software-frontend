import { CheckCircle2 } from "lucide-react";
import { FormField } from "@/components/layout/shared/form-fields";
import { Input } from "@/components/ui/input";
import { isHexColor, normalizeHex, reportTheme, type AgencyBranding, type BrandingErrors } from "@/lib/white-label/white-label";
import { brandedButton, themeStyle } from "../white-label-theme";

type ColorKey = "primaryColor" | "secondaryColor" | "accentColor";

const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Primary Color", hint: "Header bar, primary buttons and charts." },
  { key: "secondaryColor", label: "Secondary Color", hint: "Secondary buttons and highlighted panels." },
  { key: "accentColor", label: "Accent Color", hint: "Links, labels and progress meters." },
];

function ColorField({
  id,
  label,
  hint,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} htmlFor={id} error={error} hint={hint}>
      <div className="flex items-center gap-2">
        <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring/40">
          <span className="sr-only">Pick {label.toLowerCase()}</span>
          <span aria-hidden className="absolute inset-0" style={{ background: isHexColor(value) ? value : "transparent" }} />
          <input
            type="color"
            value={isHexColor(value) ? value.toLowerCase() : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          id={id}
          value={value}
          maxLength={7}
          spellCheck={false}
          className="font-mono uppercase"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-message`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const normalized = normalizeHex(value);
            if (normalized && normalized !== value) onChange(normalized);
          }}
        />
      </div>
    </FormField>
  );
}

/** Primary / secondary / accent pickers with a live preview of the resulting UI elements. */
export function BrandColors({
  branding,
  errors,
  onChange,
}: {
  branding: AgencyBranding;
  errors: BrandingErrors;
  onChange: (key: ColorKey, value: string) => void;
}) {
  // Invalid values keep the last good colour out of the preview instead of breaking it.
  const theme = reportTheme({
    ...branding,
    primaryColor: isHexColor(branding.primaryColor) ? branding.primaryColor : "#000000",
    secondaryColor: isHexColor(branding.secondaryColor) ? branding.secondaryColor : "#FFFFFF",
    accentColor: isHexColor(branding.accentColor) ? branding.accentColor : "#3B82F6",
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        {COLOR_FIELDS.map((field) => (
          <ColorField
            key={field.key}
            id={`brand-${field.key}`}
            label={field.label}
            hint={field.hint}
            value={branding[field.key]}
            error={errors[field.key]}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</p>
        <div style={themeStyle(theme)} className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
          <button type="button" tabIndex={-1} className={brandedButton.primary}>
            Primary Button
          </button>
          <button type="button" tabIndex={-1} className={brandedButton.secondary}>
            Secondary Button
          </button>
          <span className="text-sm font-medium text-(--wl-accent) underline underline-offset-4">View full report</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-(--wl-accent) px-2.5 py-0.5 text-xs font-medium text-(--wl-accent-fg)">
            <CheckCircle2 className="size-3" aria-hidden /> Status Badge
          </span>
        </div>
      </div>
    </div>
  );
}
