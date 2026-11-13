/**
 * AI per location (Phase 25a): `/locations/:locationId/ai`. What the AI may use for one location beyond
 * the Google profile. Reads for every member (a client user too); changes for owner and member (403
 * `read_only` for a client user). No AI, no Google call, no tokens.
 */

/* -------------------------------------------------------------------------- */
/* Facts, offers, events and contests (`/ai/facts`)                             */
/* -------------------------------------------------------------------------- */

export type AiFactKind = "fact" | "offer" | "event" | "contest";

/** A date in the location's time zone; no time = the whole day. */
export type AiFactDate = { date: string; time: string | null };

export type AiFact = {
  fact_id: string;
  kind: AiFactKind;
  /** `false` keeps it without the AI using it. */
  active: boolean;
  /** A fact's text (≤ 300), or an offer's, event's or contest's details. */
  text: string | null;
  /** A fact's topic (≤ 60), e.g. "Parking". */
  topic: string | null;
  /** Offers, events and contests (≤ 58). */
  title: string | null;
  start: AiFactDate | null;
  end: AiFactDate | null;
  coupon_code: string | null;
  redeem_url: string | null;
  terms: string | null;
  /** A contest's rules (https). */
  terms_url: string | null;
  /** At the location's local date and time; null for a fact. */
  timing: "upcoming" | "current" | "ended" | null;
  /** Whether the AI sees it now (active, and not ended). */
  in_fact_sheet: boolean;
  /** How AI drafts cite it. */
  sheet_id?: string;
  created_at: string;
  updated_at: string;
};

export type AiFactsList = {
  /** Newest first. */
  facts: AiFact[];
  total: number;
  /** At most 100 per location. */
  limit: number;
  /** Offers are refused for lodging and for businesses that mainly sell a regulated product: hide "Add an offer" then. */
  offers: { allowed: boolean; reason: "offer_not_allowed_for_lodging" | "offer_not_allowed_for_regulated" | null; sector: string | null };
  /** The location's local date (YYYY-MM-DD). */
  today: string;
};

/** POST body: the kind and its fields; PATCH takes the fields that change (not `kind`), `null` or "" clears one. */
export type AiFactInput = {
  kind: AiFactKind;
  text?: string | null;
  topic?: string | null;
  title?: string | null;
  start?: AiFactDate | null;
  end?: AiFactDate | null;
  coupon_code?: string | null;
  redeem_url?: string | null;
  terms?: string | null;
  terms_url?: string | null;
  active?: boolean;
};

export type AiFactPatch = Partial<Omit<AiFactInput, "kind">>;

/** One problem in a 400 `invalid_fact`; show it next to its field. */
export type AiFactIssue = {
  field: string;
  code:
    | "text_required"
    | "title_required"
    | "start_required"
    | "end_required"
    | "invalid_date"
    | "end_before_start"
    | "already_ended"
    | "invalid_url"
    | "terms_url_required"
    | "field_not_allowed"
    | "too_long"
    | (string & {});
  message: string;
};

/* -------------------------------------------------------------------------- */
/* Settings (`/ai/settings`)                                                    */
/* -------------------------------------------------------------------------- */

export type AiLogoPlacement = "ai_images" | "all_images" | "off";

export type AiSettingsValues = {
  /** Standing instructions for AI text (≤ 1,000), e.g. "Never mention prices." Used by replies now. */
  house_rules: string | null;
  /** How replies are signed (≤ 100). In restricted mode a signature naming a person is left off replies. */
  signature: string | null;
  /** How an unhappy reviewer reaches the business (≤ 160). */
  contact_line: string | null;
  /** Restricted replies: no names, nothing repeated from the review, no services named, no keywords. */
  restricted: boolean;
  /* Saved now, used by AI posts from Phase 25b and 25c. */
  logo_on: AiLogoPlacement;
  ai_images: boolean;
  ai_enhance: boolean;
  /** Days before a library photo is used again (14–365). */
  photo_reuse_days: number;
};

export type AiSettingKey = keyof AiSettingsValues;

export type AiSettings = {
  /** The values in force (the user's, else the defaults). */
  settings: AiSettingsValues;
  /** Which values are defaults (show a "default" tag). */
  is_default: Record<AiSettingKey, boolean>;
  /** Where the contact line comes from: set by the user, the Google profile's primary phone, or a role. */
  contact_line_source: "set" | "gbp_phone" | "role";
  restricted: {
    /** On by default for health, legal, financial, insurance and tax businesses. */
    suggested: boolean;
    profession: { group: "legal" | "health" | "financial" | "insurance" | "tax" | (string & {}); groups: string[]; category: string | null } | null;
    attested_by: string | null;
    attested_at: string | null;
    /** Only the owner can switch it off, with an attestation. */
    can_switch_off: boolean;
  };
  limits: { house_rules: number; signature: number; contact_line: number; photo_reuse_days: { min: number; max: number } };
  updated_at: string | null;
};

/** The text settings: "" also brings these back to their default (the backend accepts "" only for them). */
type AiTextSettingKey = "house_rules" | "signature" | "contact_line";

/**
 * PUT body: any of the settings; `null` brings one back to its default ("" too, for the text settings
 * only). Switching restricted mode off needs `attest: true` and the owner (403 `owner_only`, 400
 * `attestation_required`). Over-long values are 400 `invalid_input`.
 */
export type AiSettingsUpdate = Partial<
  { [K in AiTextSettingKey]: string | null } & { [K in Exclude<AiSettingKey, AiTextSettingKey>]: AiSettingsValues[K] | null }
> & { attest?: boolean };
