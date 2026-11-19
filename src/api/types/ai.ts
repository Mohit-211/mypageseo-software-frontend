/**
 * AI per location (Phase 25a): `/locations/:locationId/ai`. What the AI may use for one location beyond
 * the Google profile. Reads for every member (a client user too); changes for owner and member (403
 * `read_only` for a client user). No AI, no Google call, no tokens.
 *
 * Phase 25b/25c and the 2026-11-17 follow-ups add the business brief (`/ai/brief`), the readiness
 * checklist (`/ai/readiness`), the logo (`/locations/:locationId/logo`), the image style, the style memo
 * and names next to attestations. Shapes: backend docs/API.md "AI per location (Phase 25a)", "Business
 * brief", "Readiness", "The logo"; ENDPOINTS #252–#264, #281–#283.
 */

/* -------------------------------------------------------------------------- */
/* Shared: rollout switches and AI prices                                       */
/* -------------------------------------------------------------------------- */

/**
 * A feature behind a server rollout switch (automatic replies, the business brief, automatic publishing of
 * series, the series planner): `on`, `switched_off` (not switched on yet) or `not_in_pilot` (not switched on
 * for this account yet). Show the feature's controls only when it is `on`; never say "server".
 */
export type AiFeatureState = "on" | "switched_off" | "not_in_pilot";

/**
 * The plan's AI prices in tokens: `GET billing` → `tokens.ai_costs`, `GET pricing` → `ai_token_costs`, and
 * the reviews and posts summaries' `ai.token_costs`. Exactly these six keys since 2026-11-17 (`post_topics`
 * is gone: topics are planned free). Replies and analyses are bought in blocks of `credits.block_size` (10)
 * per location: `reply_drafts_per_10` / `analysis_per_10` is the price of one block (0–100), so never
 * hard-code "1 token = 10 replies" (see `src/lib/reviews/reply-credits.ts`).
 */
export type AiTokenCosts = {
  reply_drafts_per_10: number;
  analysis_per_10: number;
  appeal: number;
  insights: number;
  post_draft: number;
  post_image: number;
};

/* -------------------------------------------------------------------------- */
/* Facts, offers, events and contests (`/ai/facts`)                             */
/* -------------------------------------------------------------------------- */

/**
 * Why the AI can't use an offer (2026-11-17), which then has `in_fact_sheet: false`: the business's categories
 * first (a hotel: `sector` and `term` null; a liquor store: `sector: "alcohol"`, `term` null), else the regulated
 * word the offer's own text names (`{ reason: "offer_not_allowed_for_regulated", sector: "alcohol", term: "cocktails" }`).
 */
export type AiOfferRefusal = {
  reason: "offer_not_allowed_for_lodging" | "offer_not_allowed_for_regulated";
  sector: string | null;
  term: string | null;
};

/** The location's local date and time when the timings were computed (2026-11-17; replaces `today`). */
export type AiFactsNow = {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:mm. */
  time: string;
  /** The location's IANA zone, UTC when it has none. */
  time_zone: string;
};

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
  /** Phase 25b: `"brief:<itemId>"` for a fact made from a confirmed business brief suggestion ("From the brief"), else null. */
  source_ref?: string | null;
  /** 2026-11-17: why the AI can't use this offer (null for an offer it may use and for the other kinds). */
  offer_refusal?: AiOfferRefusal | null;
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
  /**
   * 2026-11-17: the location's local date and time (use `now.date`). An end with no time counts as the end of
   * that day; the server still refuses an end that has passed (400 `invalid_fact`, `{ field: "end", code: "already_ended" }`).
   */
  now?: AiFactsNow;
  /** @deprecated Removed on 2026-11-17 (servers before it only): read `now?.date ?? today`. */
  today?: string;
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

/** Where the logo goes on post pictures. Default `all_images` since Phase 25c (it was `ai_images`). */
export type AiLogoPlacement = "ai_images" | "all_images" | "off";

/**
 * Phase 25c: how a post's picture is finished. `photo_logo` (default): the picture with the logo in a quiet
 * corner. `designed`: a headline band in the brand's colours with the logo, drawn by code. Show with the choice
 * that Google's photo guidelines ask for pictures without added text, so Google may reject some designed
 * graphics (`photo_logo` is the safe choice).
 */
export type AiImageStyleSetting = "photo_logo" | "designed";

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
  /** Phase 25c (older servers leave it out). */
  image_style?: AiImageStyleSetting;
};

export type AiSettingKey = keyof AiSettingsValues;

/**
 * Phase 25b: what the AI learned from how the owner edits its review replies (every 10 replies a person
 * sends): "What the AI learned from your edits", each with a "Don't use" toggle (`style_memo.dismiss` /
 * `restore`). A dismissed item stays listed so it is never learned again. A note for one kind of review
 * starts with it ("For praise (4-5★ with nothing to fix):", "For a reservation …:", "For a complaint (1-2★):").
 */
export type AiStyleMemo = {
  items: { id: string; text: string; dismissed: boolean }[];
  updated_at: string | null;
};

/** Phase 25b: why automatic replies are paused (`user`: a person; `admin`: MyPageSEO; Google's rejection; a restricted Google account). */
export type AutoReplyPauseReason = "user" | "admin" | "google_rejected" | "account_restricted";

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
    /**
     * 2026-11-17: the attesting owner's profile name; null for a deleted or unnamed account, and for a client
     * user looking at someone outside its own client and the owner (show "Your agency"). Never an email.
     */
    attested_by_name?: string | null;
    attested_at: string | null;
    /** 2026-11-17: an owner or a member may switch it on, whatever the state (`settings.restricted` is the state). A client user: false. */
    can_switch_on?: boolean;
    /** Only the owner can switch it off, with an attestation. Since 2026-11-17 it follows the role whether it is on or off. */
    can_switch_off: boolean;
  };
  limits: { house_rules: number; signature: number; contact_line: number; photo_reuse_days: { min: number; max: number } };
  updated_at: string | null;
  /** Phase 25b: null until the first item is learned. */
  style_memo?: AiStyleMemo | null;
  /**
   * Phase 25b: the location's automatic replies, read-only here (they are set, with their consent, through
   * `GET/PUT …/reviews/auto-reply`); null when never set up.
   */
  auto_reply?: { enabled: boolean; paused: { reason: AutoReplyPauseReason; at: string } | null } | null;
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
> & {
  attest?: boolean;
  /** Phase 25b: "Don't use" (`dismiss`) or bring back (`restore`) style memo items by id (`sm_…`, ≤ 20 each). */
  style_memo?: { dismiss?: string[]; restore?: string[] };
};

/* -------------------------------------------------------------------------- */
/* Business brief (`/ai/brief`, Phase 25b; behind its rollout switch)           */
/* -------------------------------------------------------------------------- */

/** `none` (nothing built yet), `queued`, `building`, `ready` (a version exists), `failed` (none built: `build.last_status` says why). */
export type BriefStatus = "none" | "queued" | "building" | "ready" | "failed";

/** The lists of the brief the owner edits. */
export type BriefSection = "services" | "differentiators" | "faqs" | "audience" | "local" | "pillars" | "do_not_say";

/** A quote found word for word on a page (`source_id` points into `brief.sources`). */
export type BriefEvidence = { source_id: string; quote: string };

/** What every brief item carries. `locked`: the owner wrote or corrected it; `removed`: the owner took it out (the AI never sees it). */
export type BriefItemBase = {
  id: string;
  /** Into `brief.sources`; `owner` for an item the owner added. */
  source_ids: string[];
  /** At most 3. */
  evidence: BriefEvidence[];
  locked: boolean;
  removed: boolean;
  origin: "website" | "owner";
};

export type BriefService = BriefItemBase & {
  name: string;
  summary: string;
  details: string[];
  audience: string | null;
  problems: string[];
  seasonality: string | null;
  /** The service's own page (for posts' "Learn more" buttons). */
  page_url: string | null;
};

export type BriefFaq = BriefItemBase & { question: string; answer: string };
export type BriefPillar = BriefItemBase & { name: string; description: string };
/** Differentiators, audience, local (areas served) and do-not-say items. */
export type BriefTextItem = BriefItemBase & { text: string };

export type BriefFormality = "formal" | "neutral" | "casual";
export type BriefWarmth = "reserved" | "warm" | "very_warm";

export type BriefVoice = {
  formality: BriefFormality | null;
  warmth: BriefWarmth | null;
  vocabulary: string[];
  avoid: string[];
  source_ids: string[];
  locked: boolean;
};

export type BriefSuggestionStatus = "suggested" | "confirmed" | "dismissed";

/**
 * A proof point (`pp_…`: years, licence, certification, award, membership, other) or a research item
 * (`rs_…`, with its `url`) the owner confirms or dismisses. The AI states it only once confirmed (it then
 * becomes an owner fact, `fact_id`).
 */
export type BriefSuggestion = {
  id: string;
  kind: string;
  text: string;
  source_ids: string[];
  evidence: BriefEvidence[];
  status: BriefSuggestionStatus;
  fact_id: string | null;
  decided_at: string | null;
  decided_by: string | null;
  /** Research items: the page that says it. */
  url?: string;
};

/** What the site read found: `spam_suspected`, `javascript_only`, `robots_unreachable`, `blocked_by_robots`, `robots_too_complex`, `page_failed`, `time_limit`, … */
export type BriefWarning = { code: string; url: string | null; detail: string | null };

export type BriefSource = {
  /** "page:1", "research:2". */
  id: string;
  kind: "page" | "research";
  url: string;
  title: string | null;
  page_kind: string | null;
  read_at: string;
};

export type BusinessBrief = {
  version: number;
  /** null for a brief the owner started before any build. */
  built_at: string | null;
  edited_at: string | null;
  researched_at: string | null;
  model: string | null;
  services: BriefService[];
  differentiators: BriefTextItem[];
  faqs: BriefFaq[];
  audience: BriefTextItem[];
  local: BriefTextItem[];
  pillars: BriefPillar[];
  do_not_say: BriefTextItem[];
  voice: BriefVoice;
  proof_points: BriefSuggestion[];
  research: BriefSuggestion[];
  service_pages: { service_id: string; name: string; url: string }[];
  logo_candidates: { url: string; source: string }[];
  warnings: BriefWarning[];
  sources: BriefSource[];
  /** How many of its items the AI may state. */
  facts: number;
  /** Proof points and research waiting for the owner. */
  suggestions_pending: number;
};

/** `GET …/ai/brief` (and the answer of `PATCH`). Show the brief only when `feature` is `on`. */
export type BusinessBriefView = {
  feature: AiFeatureState;
  status: BriefStatus;
  brief: BusinessBrief | null;
  /** The website's last read (no text); `status` is `ok`, or `blocked_by_robots`, `unreachable`, `not_html`, `spam_suspected`. */
  site: {
    url: string;
    read_at: string;
    status: string;
    pages: { url: string; kind: string; title: string | null; depth: number; chunks: number; spam: boolean }[];
    warnings: BriefWarning[];
  } | null;
  build: { reason: string | null; requested_at: string | null; started_at: string | null; finished_at: string | null; last_status: string | null };
  research: { configured: boolean; researched_at: string | null; last_status: string | null; next_due_at: string | null };
  /** Poll `GET …/ai/brief` while `pending` (after "Read my website again"). */
  refresh: { requested_at: string | null; pending: boolean; next_allowed_at: string | null };
  previous_versions: { version: number; built_at: string | null }[];
};

/**
 * One change in `PATCH …/ai/brief` (≤ 50 per call): edit (`id` + the fields), add (no `id`), remove
 * (`{ id, remove: true }`) or reset (`{ id, reset: true }`, not for an owner item). Fields by section:
 * services `name`, `summary`, `details`, `audience`, `problems`, `seasonality`, `page_url` (on the business's
 * own site); FAQs `question`, `answer`; pillars `name`, `description`; the others `text`.
 */
export type BriefItemChange = {
  section: BriefSection;
  id?: string;
  remove?: true;
  reset?: true;
  name?: string;
  summary?: string;
  details?: string[];
  audience?: string | null;
  problems?: string[];
  seasonality?: string | null;
  page_url?: string | null;
  question?: string;
  answer?: string;
  description?: string;
  text?: string;
};

export type BriefVoiceChange =
  | { formality?: BriefFormality | null; warmth?: BriefWarmth | null; vocabulary?: string[]; avoid?: string[] }
  | { reset: true };

/** `PATCH …/ai/brief`. 400 `invalid_change` (+ `field`), `too_many_items` (20 of the owner's own per section); 404 `brief_item_not_found`; 409 `brief_changed`. */
export type BriefPatch = { items?: BriefItemChange[]; voice?: BriefVoiceChange };

/** `POST …/ai/brief/refresh` (202). */
export type BriefRefreshAnswer = { queued: true; reads_website: boolean; research: boolean; next_allowed_at: string | null };

/** `POST …/ai/brief/suggestions/:itemId`: a confirmation creates the owner fact (`source_ref: "brief:<itemId>"`); `fact` is null for a dismissal. */
export type BriefSuggestionAnswer = { suggestion: BriefSuggestion; fact: AiFact | null };

/* -------------------------------------------------------------------------- */
/* Readiness ("Get the AI ready · N of M done", `/ai/readiness`)                */
/* -------------------------------------------------------------------------- */

export type AiReadinessKey = "brief" | "owner_facts" | "signature" | "logo" | "photos";

/**
 * `GET …/ai/readiness`. `done` of `total` counts the available checks; leave out a check with
 * `available: false` (the brief while its switch is off). `next`: the available checks not done, in order
 * (the first is what to do next). Link each to its screen.
 */
export type AiReadiness = {
  ready: boolean;
  done: number;
  total: number;
  next: AiReadinessKey[];
  checks: Record<AiReadinessKey, { available: boolean; done: boolean }>;
  details: {
    brief?: { feature: AiFeatureState; status: BriefStatus; version: number | null; built_at: string | null; facts: number; suggestions_pending: number };
    /** At least `recommended` (3) active facts of the owner's (`kind: fact`). */
    owner_facts?: { active: number; recommended: number };
    signature?: { value: string | null };
    logo?: { set: boolean; source: "upload" | "website" | null };
    /** Library photos: `usable` (screened ok, not poor), `pending` (still being checked), `flagged` (kept out). */
    photos?: { library: number; usable: number; pending: number; flagged: number };
  };
};

/* -------------------------------------------------------------------------- */
/* The logo (`/locations/:locationId/logo`, Phase 25c; an AI Settings section)  */
/* -------------------------------------------------------------------------- */

export type LocationLogo = {
  mime: string;
  width: number;
  height: number;
  bytes: number;
  /** The logo is private: show it from this data URL (never a public address). */
  data_url: string;
  transparent: boolean;
  /** The logo's main colours. */
  palette: string[];
  source: "upload" | "website";
  source_url: string | null;
  copied_from: string | null;
  attested_by: string | null;
  /** 2026-11-17: who attested it, by name (null: deleted or unnamed account, or hidden from a client user: "Your agency"). */
  attested_by_name?: string | null;
  attested_at: string | null;
  updated_at: string;
};

/** A logo found on the business's website ("Use the logo from your website"), likeliest first. */
export type LogoCandidate = { url: string; source: "jsonld" | "img" | "apple_touch_icon" | "icon" | "og_image" | (string & {}) };

/** `GET/PUT/DELETE …/logo`. `applied_to`: on a PUT with `apply_to: "organization"`, the other locations given it. */
export type LocationLogoView = {
  logo: LocationLogo | null;
  candidates: LogoCandidate[];
  /** Show "Use this logo for all my locations" only when true (a Business organization's owner). */
  can_apply_to_organization: boolean;
  applied_to?: number;
};

/**
 * `PUT …/logo`: exactly one of `data` (base64 or a data URL of a PNG, JPEG or WebP ≤ 512 KB) and
 * `candidate_url` (one of `candidates`), always `attest: true` ("This is my business's own logo").
 */
export type LocationLogoInput = ({ data: string; candidate_url?: never } | { candidate_url: string; data?: never }) & {
  attest: true;
  apply_to?: "organization";
};

/** What a refused logo (422 `logo_rejected`, `issues`) carries: say what to remove. */
export type LogoIssue = "phone_number" | "web_address" | "email" | "social_handle" | "qr_code" | "badge" | "too_many_words" | "unsafe";
