import { isApiError, type Branding, type BrandingInput } from "@/api";
import { HEX, WEBSITE_URL } from "./branding";
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, hexOr } from "./color";

/**
 * The brand editor's form (`PUT organization/branding`). Every field is a string or a boolean
 * while editing; `toBrandingInput` turns it into what the backend accepts.
 */
export type BrandForm = {
  agency_name: string;
  website_url: string;
  primary_color: string;
  secondary_color: string;
  footer_text: string;
  contact_text: string;
  hide_mypageseo: boolean;
  email_sender_name: string;
  email_reply_to: string;
};

/** The backend's limits (`reports.validation.ts` → validateBrandingUpdate). */
export const BRAND_LIMITS = {
  agency_name: 150,
  website_url: 300,
  contact_text: 300,
  footer_text: 300,
  email_sender_name: 60,
  email_reply_to: 200,
} as const;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function toBrandForm(branding: Branding): BrandForm {
  return {
    agency_name: branding.agency_name ?? "",
    website_url: branding.website_url ?? "",
    primary_color: hexOr(branding.primary_color, DEFAULT_PRIMARY),
    secondary_color: hexOr(branding.secondary_color, DEFAULT_SECONDARY),
    footer_text: branding.footer_text ?? "",
    contact_text: branding.contact_text ?? "",
    hide_mypageseo: branding.hide_mypageseo,
    email_sender_name: branding.email_sender_name ?? "",
    email_reply_to: branding.email_reply_to ?? "",
  };
}

export function sameBrandForm(a: BrandForm, b: BrandForm): boolean {
  return (Object.keys(a) as (keyof BrandForm)[]).every((key) => a[key] === b[key]);
}

export type BrandFormErrors = Partial<Record<keyof BrandForm, string>>;

/** Field errors to show before saving (the backend would refuse these with a raw message). */
export function brandFormErrors(form: BrandForm): BrandFormErrors {
  const errors: BrandFormErrors = {};
  const website = form.website_url.trim();
  if (website && (!WEBSITE_URL.test(website) || website.length > BRAND_LIMITS.website_url)) {
    errors.website_url = "Start with http:// or https://, for example https://youragency.com.";
  }
  if (!HEX.test(form.primary_color)) errors.primary_color = "Use a colour like #1d4ed8.";
  if (!HEX.test(form.secondary_color)) errors.secondary_color = "Use a colour like #0f766e.";
  const replyTo = form.email_reply_to.trim();
  if (replyTo && (!EMAIL.test(replyTo) || replyTo.length > BRAND_LIMITS.email_reply_to)) {
    errors.email_reply_to = "Enter an email address, or leave it empty.";
  }
  for (const key of ["agency_name", "contact_text", "footer_text", "email_sender_name"] as const) {
    if (form[key].trim().length > BRAND_LIMITS[key]) errors[key] = `Keep it to ${BRAND_LIMITS[key]} characters.`;
  }
  return errors;
}

/**
 * What to send. Text fields are trimmed (`""` clears one). The reply-to address must be an email
 * or null: the backend refuses `""` ("email_reply_to is not allowed to be empty"), which used to
 * make every save without a reply-to fail. Colours are always sent as `#rrggbb` (never `""`).
 */
export function toBrandingInput(form: BrandForm): BrandingInput {
  return {
    agency_name: form.agency_name.trim(),
    website_url: form.website_url.trim(),
    primary_color: form.primary_color.toLowerCase(),
    secondary_color: form.secondary_color.toLowerCase(),
    footer_text: form.footer_text.trim(),
    contact_text: form.contact_text.trim(),
    hide_mypageseo: form.hide_mypageseo,
    email_sender_name: form.email_sender_name.trim(),
    email_reply_to: form.email_reply_to.trim() || null,
  };
}

/** The name on the brand: the agency name, else the organization's name. */
export function brandName(form: Pick<BrandForm, "agency_name">, fallback: string | null | undefined): string {
  return form.agency_name.trim() || fallback?.trim() || "Your agency";
}

/** Who report emails come from (the backend's rule in reportEmail.service). */
export function emailSender(form: Pick<BrandForm, "email_sender_name" | "agency_name">, fallbackName: string | null | undefined): string {
  return form.email_sender_name.trim() || `${brandName(form, fallbackName)} via MyPageSEO`;
}

/** "northwinddigital.example" from a website URL (or the text itself when it isn't a URL). */
export function websiteHost(url: string | null | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

/** What the live preview draws: the brand as clients would see it right now (the form, not the saved values). */
export type BrandPreviewData = {
  name: string;
  websiteHost: string | null;
  primary: string;
  secondary: string;
  contact: string;
  footer: string;
  hideMyPageSeo: boolean;
  sender: string;
  replyTo: string;
};

/** The preview of a form being edited; colours that aren't valid yet fall back to the defaults. */
export function toPreviewData(form: BrandForm, fallbackName: string | null | undefined): BrandPreviewData {
  return {
    name: brandName(form, fallbackName),
    websiteHost: websiteHost(form.website_url),
    primary: hexOr(form.primary_color, DEFAULT_PRIMARY),
    secondary: hexOr(form.secondary_color, DEFAULT_SECONDARY),
    contact: form.contact_text.trim(),
    footer: form.footer_text.trim(),
    hideMyPageSeo: form.hide_mypageseo,
    sender: emailSender(form, fallbackName),
    replyTo: form.email_reply_to.trim(),
  };
}

/** Copy for a refused save, by `data.reason`. */
export function brandSaveErrorText(error: unknown): string {
  if (!isApiError(error)) return "Your brand couldn't be saved. Try again.";
  switch (error.reason) {
    case "owner_only":
      return "Only the account owner can change your brand.";
    case "feature_not_included":
      return "Your plan doesn't include white-label branding.";
    case "agency_only":
      return "White label is for agency accounts.";
    default:
      return error.status === 400 && error.message ? error.message : "Your brand couldn't be saved. Try again.";
  }
}

/** Copy for a refused logo upload or removal. */
export function logoErrorText(error: unknown, fallback: string): string {
  if (!isApiError(error)) return fallback;
  switch (error.reason) {
    case "logo_too_large":
      return "The logo must be 512 KB or smaller.";
    case "logo_type":
      return "Use a PNG or JPEG logo.";
    case "owner_only":
      return "Only the account owner can change your logo.";
    case "feature_not_included":
      return "Your plan doesn't include white-label branding.";
    default:
      return fallback;
  }
}
