/**
 * The "AI settings" form (`GET/PUT /locations/:locationId/ai/settings`, Phase 25a; the image style and the
 * `all_images` logo default since Phase 25c), pure.
 *
 * The page keeps only the user's edits (`AiSettingsEdits`) on top of the settings in force, so a
 * save of one section, a restricted-mode switch or a refetch never overwrites what the user is
 * typing elsewhere. Each setting shows the value in force with a "Default" tag (`is_default`), and
 * "Use default" sends `null` ("" for a text field), which brings it back to its default.
 * - Text settings (house rules, signature, contact line): an empty field means "the default".
 * - The image settings: `null` means "the default" (staged by "Use default"); the control then
 *   shows the documented default until the answer says what is in force.
 * Restricted mode isn't part of this form: it switches at once (`restricted-mode-section.tsx`), and
 * neither is the style memo (each "Don't use" saves at once, `style-memo.ts`).
 */
import type { AiImageStyleSetting, AiLogoPlacement, AiSettings, AiSettingsUpdate } from "@/api";
import { formatDate } from "@/lib/datetime";
import { byActor, isViewer } from "./names";

export const TEXT_SETTING_KEYS = ["house_rules", "signature", "contact_line"] as const;
export type TextSettingKey = (typeof TEXT_SETTING_KEYS)[number];

export const IMAGE_SETTING_KEYS = ["logo_on", "image_style", "ai_images", "ai_enhance", "photo_reuse_days"] as const;
export type ImageSettingKey = (typeof IMAGE_SETTING_KEYS)[number];

export type FormSettingKey = TextSettingKey | ImageSettingKey;

/** The page's two forms, each with its own save bar. */
export type SettingsSection = "replies" | "images";

export const SECTION_KEYS: Record<SettingsSection, readonly FormSettingKey[]> = {
  replies: TEXT_SETTING_KEYS,
  images: IMAGE_SETTING_KEYS,
};

/** What the controls hold. */
export type AiSettingsForm = {
  house_rules: string;
  signature: string;
  contact_line: string;
  /** `null`: back to the default when saved. */
  logo_on: AiLogoPlacement | null;
  /** Phase 25c: a photo with the logo in a corner, or a designed graphic. */
  image_style: AiImageStyleSetting | null;
  ai_images: boolean | null;
  ai_enhance: boolean | null;
  /** The number field's text, so a half-typed value stays as typed; `null`: back to the default. */
  photo_reuse_days: string | null;
};

/** Only the settings the user changed (a key is absent until it is touched). */
export type AiSettingsEdits = Partial<AiSettingsForm>;

/**
 * The defaults of the settings that have a fixed one (backend docs, API.md "AI per location",
 * Settings table; `logo_on` is `all_images` since Phase 25c). Shown while a "Use default" waits to be
 * saved; the answer then says what is in force.
 */
export const AI_SETTING_DEFAULTS = {
  logo_on: "all_images",
  image_style: "photo_logo",
  ai_images: true,
  ai_enhance: true,
  photo_reuse_days: 60,
} as const satisfies { [K in Exclude<ImageSettingKey, "photo_reuse_days">]: Exclude<AiSettingsForm[K], null> } & { photo_reuse_days: number };

/** True when the answer has the image style (Phase 25c); the control is left out otherwise. */
export function hasImageStyle(view: AiSettings): boolean {
  return view.settings.image_style !== undefined;
}

/** The backend's limits, used until the answer's own `limits` are known. */
export const AI_SETTING_LIMITS = { house_rules: 1000, signature: 100, contact_line: 160, photo_reuse_days: { min: 14, max: 365 } } as const;

const trimmed = (value: string | null | undefined) => (value ?? "").trim();

/** The value a control shows: the user's edit, else what is in force. */
export function formValue<K extends FormSettingKey>(view: AiSettings, edits: AiSettingsEdits, key: K): AiSettingsForm[K] {
  if (key in edits) return edits[key] as AiSettingsForm[K];
  const value: unknown = view.settings[key];
  if (key === "photo_reuse_days") return String(value) as AiSettingsForm[K];
  if (key === "house_rules" || key === "signature" || key === "contact_line") return (value ?? "") as AiSettingsForm[K];
  // An answer without the image style (before Phase 25c) shows its default.
  return (value ?? null) as AiSettingsForm[K];
}

/** The image settings' controls: a staged default shows the documented default. */
export function shownImageValue<K extends ImageSettingKey>(view: AiSettings, edits: AiSettingsEdits, key: K): Exclude<AiSettingsForm[K], null> {
  const value = formValue(view, edits, key);
  if (value !== null) return value as Exclude<AiSettingsForm[K], null>;
  return (key === "photo_reuse_days" ? String(AI_SETTING_DEFAULTS.photo_reuse_days) : AI_SETTING_DEFAULTS[key]) as Exclude<AiSettingsForm[K], null>;
}

/** True when the edit of `key` would change what is saved. */
export function isChanged(view: AiSettings, edits: AiSettingsEdits, key: FormSettingKey): boolean {
  if (!(key in edits)) return false;
  const edit = edits[key];
  const isDefault = view.is_default[key];
  if (key === "house_rules" || key === "signature" || key === "contact_line") {
    const next = trimmed(edit as string);
    // Empty is the default: a change only when something else is in force now.
    if (next === "") return !isDefault;
    return next !== trimmed(view.settings[key]);
  }
  if (edit === null) return !isDefault;
  if (key === "photo_reuse_days") return Number((edit as string).trim()) !== view.settings.photo_reuse_days || (edit as string).trim() === "";
  if (key === "image_style") return edit !== (view.settings.image_style ?? AI_SETTING_DEFAULTS.image_style);
  return edit !== view.settings[key];
}

/** The keys of `keys` whose edit would change what is saved. */
export function changedKeys(view: AiSettings, edits: AiSettingsEdits, keys: readonly FormSettingKey[]): FormSettingKey[] {
  return keys.filter((key) => isChanged(view, edits, key));
}

/** True when `key` will be a default once saved (the "Default" tag): in force by default and untouched, or reset. */
export function willBeDefault(view: AiSettings, edits: AiSettingsEdits, key: FormSettingKey): boolean {
  if (!(key in edits)) return view.is_default[key];
  const edit = edits[key];
  if (key === "house_rules" || key === "signature" || key === "contact_line") {
    return trimmed(edit as string) === "" || (view.is_default[key] && !isChanged(view, edits, key));
  }
  return edit === null || (view.is_default[key] && !isChanged(view, edits, key));
}

/** "Use default" is offered while a value the user set is in force and isn't already reset. */
export function canUseDefault(view: AiSettings, edits: AiSettingsEdits, key: FormSettingKey): boolean {
  return !willBeDefault(view, edits, key);
}

/** What "Use default" puts in the control. */
export function defaultEdit(key: FormSettingKey): AiSettingsForm[FormSettingKey] {
  return key === "house_rules" || key === "signature" || key === "contact_line" ? "" : null;
}

export type SettingsErrors = Partial<Record<FormSettingKey, string>>;

/** Problems to fix before saving (the backend would refuse these with a raw message). */
export function settingsErrors(view: AiSettings, edits: AiSettingsEdits, keys: readonly FormSettingKey[]): SettingsErrors {
  const errors: SettingsErrors = {};
  const limits = view.limits ?? AI_SETTING_LIMITS;
  for (const key of keys) {
    if (!isChanged(view, edits, key)) continue;
    if (key === "house_rules" || key === "signature" || key === "contact_line") {
      const max = limits[key];
      if (trimmed(edits[key] as string).length > max) errors[key] = `Keep it to ${max.toLocaleString()} characters.`;
    } else if (key === "photo_reuse_days" && edits.photo_reuse_days !== null) {
      const { min, max } = limits.photo_reuse_days;
      const text = (edits.photo_reuse_days ?? "").trim();
      const days = Number(text);
      if (!/^\d+$/.test(text) || days < min || days > max) errors.photo_reuse_days = `Use a whole number of days from ${min} to ${max}.`;
    }
  }
  return errors;
}

/** The `PUT` body: only the changed keys; `null` brings a setting back to its default. */
export function settingsPayload(view: AiSettings, edits: AiSettingsEdits, keys: readonly FormSettingKey[]): AiSettingsUpdate {
  const body: AiSettingsUpdate = {};
  for (const key of changedKeys(view, edits, keys)) {
    if (key === "house_rules" || key === "signature" || key === "contact_line") {
      body[key] = trimmed(edits[key] as string) || null;
    } else if (key === "photo_reuse_days") {
      body.photo_reuse_days = edits.photo_reuse_days === null ? null : Number((edits.photo_reuse_days ?? "").trim());
    } else if (key === "logo_on") {
      body.logo_on = edits.logo_on ?? null;
    } else if (key === "image_style") {
      body.image_style = edits.image_style ?? null;
    } else {
      body[key] = edits[key] ?? null;
    }
  }
  return body;
}

/** The edits left after a save: the keys sent are dropped, unless the user changed them again meanwhile. */
export function editsAfterSave(current: AiSettingsEdits, sent: AiSettingsEdits): AiSettingsEdits {
  const next: AiSettingsEdits = { ...current };
  for (const key of Object.keys(sent) as FormSettingKey[]) {
    if (next[key] === sent[key]) delete next[key];
  }
  return next;
}

/** The edits without one section's keys (Discard). */
export function editsWithout(current: AiSettingsEdits, keys: readonly FormSettingKey[]): AiSettingsEdits {
  const next: AiSettingsEdits = { ...current };
  for (const key of keys) delete next[key];
  return next;
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

/** Where the contact line in force comes from. */
export const CONTACT_LINE_SOURCE_COPY: Record<AiSettings["contact_line_source"], string> = {
  gbp_phone: "From your Google profile's phone number",
  role: "A role, because your Google profile has no phone",
  set: "Set by you",
};

const PROFESSION_COPY: Record<string, string> = {
  health: "health",
  legal: "legal",
  financial: "financial",
  insurance: "insurance",
  tax: "tax",
};

/** "Suggested for health businesses" (restricted mode's default for this business's category). */
export function restrictedSuggestionText(restricted: AiSettings["restricted"]): string {
  if (!restricted.suggested) return "Off by default for this kind of business";
  const group = restricted.profession?.group;
  const words = group ? PROFESSION_COPY[group] : undefined;
  return words ? `Suggested for ${words} businesses` : "Suggested for this kind of business";
}

/**
 * "Switched off by Ana Diaz on Nov 13, 2026." while restricted mode is off and someone switched it off (null
 * otherwise). Only the account owner can, so without a name to show it reads "by the account owner" ("by your
 * agency" for a client user): the names rule of `names.ts`.
 */
export function restrictedOffText(view: Pick<AiSettings, "settings" | "restricted">, viewer: { userId: string | null; clientUser: boolean }): string | null {
  const { restricted } = view;
  if (view.settings.restricted || !restricted.attested_at) return null;
  const by = byActor({ name: restricted.attested_by_name, mine: isViewer(restricted.attested_by, viewer.userId), role: "owner" }, viewer);
  return `Switched off${by} on ${formatDate(restricted.attested_at)}.`;
}

/** In the order the choice shows them: the default first. */
export const LOGO_PLACEMENTS: readonly AiLogoPlacement[] = ["all_images", "ai_images", "off"];

export const LOGO_PLACEMENT_COPY: Record<AiLogoPlacement, { label: string; hint: string }> = {
  all_images: { label: "All pictures", hint: "Your logo goes on your own photos and on AI images, in the quietest corner." },
  ai_images: { label: "AI images only", hint: "Your logo goes only on images the AI makes, not on your own photos." },
  off: { label: "Off", hint: "No logo on post pictures." },
};

/** In the order the choice shows them: the default (and the safe choice) first. */
export const IMAGE_STYLES: readonly AiImageStyleSetting[] = ["photo_logo", "designed"];

export const IMAGE_STYLE_COPY: Record<AiImageStyleSetting, { label: string; hint: string }> = {
  photo_logo: { label: "Photo with your logo", hint: "The picture as it is, with your logo in a quiet corner. The safe choice for Google." },
  designed: { label: "Designed graphic", hint: "The picture with a short headline band in your logo's colours, with your logo in it." },
};

/**
 * Next to "Designed graphic" (backend docs, API.md "Settings", `image_style`): Google's photo guidelines ask for
 * pictures without added text.
 */
export const DESIGNED_IMAGE_NOTE =
  "Google's photo guidelines ask for pictures without added text, so Google may reject some designed graphics. A photo with your logo is the safe choice.";
