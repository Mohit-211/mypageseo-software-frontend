import { FormField, FormGrid, FormSelectField, FormTextField } from "@/components/layout/shared/form-fields";
import {
  AGENCY_NAME_MAX_LENGTH,
  BRAND_FONT_LABEL,
  BUTTON_STYLE_LABEL,
  BUTTON_STYLE_RADIUS,
  type AgencyBranding,
  type BrandFont,
  type BrandingErrors,
  type ButtonStyle,
} from "@/lib/white-label/white-label";
import { cn } from "@/lib/utils";

type Update = <K extends keyof AgencyBranding>(key: K, value: AgencyBranding[K]) => void;

export function AgencyIdentityFields({ branding, errors, onChange }: { branding: AgencyBranding; errors: BrandingErrors; onChange: Update }) {
  return (
    <FormGrid>
      <FormTextField
        id="agency-name"
        label="Agency Name"
        required
        value={branding.agencyName}
        maxLength={AGENCY_NAME_MAX_LENGTH + 20}
        placeholder="ABC Digital Marketing"
        error={errors.agencyName}
        hint="Shown in the report header in place of MyPageSEO."
        onChange={(value) => onChange("agencyName", value)}
        className="sm:col-span-2"
      />
      <FormTextField
        id="footer-text"
        label="Footer Text"
        optional
        value={branding.footerText}
        placeholder="ABC Digital Marketing"
        hint="Printed after the © in the report footer."
        onChange={(value) => onChange("footerText", value)}
      />
      <FormTextField
        id="contact-email"
        label="Contact Email"
        optional
        type="email"
        value={branding.contactEmail}
        placeholder="agency@example.com"
        error={errors.contactEmail}
        onChange={(value) => onChange("contactEmail", value)}
      />
      <FormTextField
        id="agency-website"
        label="Website"
        optional
        type="url"
        value={branding.website}
        placeholder="https://example.com"
        error={errors.website}
        onChange={(value) => onChange("website", value)}
        className="sm:col-span-2"
      />
    </FormGrid>
  );
}

const BUTTON_STYLES: ButtonStyle[] = ["rounded", "medium", "square"];

export function StyleFields({ branding, onChange }: { branding: AgencyBranding; onChange: Update }) {
  return (
    <FormGrid>
      <FormField label="Button Style" htmlFor="button-style-rounded" hint="Applies to buttons, badges and icon tiles in reports.">
        <div role="radiogroup" aria-label="Button style" className="grid grid-cols-3 gap-2">
          {BUTTON_STYLES.map((style) => {
            const selected = branding.buttonStyle === style;
            return (
              <button
                key={style}
                id={`button-style-${style}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange("buttonStyle", style)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected ? "border-primary bg-brand-tint text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span aria-hidden className="h-5 w-12 bg-primary/80" style={{ borderRadius: BUTTON_STYLE_RADIUS[style] }} />
                {BUTTON_STYLE_LABEL[style]}
              </button>
            );
          })}
        </div>
      </FormField>
      <FormSelectField
        id="brand-font"
        label="Typography"
        value={branding.font}
        onChange={(value) => onChange("font", value as BrandFont)}
        options={(Object.keys(BRAND_FONT_LABEL) as BrandFont[]).map((font) => ({ value: font, label: BRAND_FONT_LABEL[font] }))}
        hint="Fonts already supported by client reports."
      />
    </FormGrid>
  );
}
