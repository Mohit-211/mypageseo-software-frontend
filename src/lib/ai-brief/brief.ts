/**
 * The business brief (Phase 25b, `/locations/:locationId/ai/brief`), pure: what the business's own website says
 * about it, read and checked for the AI. Free, no tokens; behind the server's switch (`feature` must be `on`).
 *
 * - Sections (services, what sets it apart, FAQs, who it serves, areas, post themes, what never to say), each item
 *   with the quotes found on its page (`evidence` → `brief.sources`), and the voice.
 * - The owner's corrections (`PATCH`: edit, add, remove, reset an item; set or reset the voice) survive every
 *   rebuild: `locked` items are the owner's words, `removed` ones the AI never sees, `origin: owner` ones they added.
 * - Suggestions (proof points `pp_…`, web research `rs_…`) wait for Confirm (it becomes an owner fact) or Dismiss.
 * - `status` `queued` / `building` (or `refresh.pending`): poll until it settles.
 * Limits mirror the backend (`BRIEF_LIMITS`, `briefOwner.service.ts`).
 */
import {
  apiErrorData,
  isApiError,
  type BriefEvidence,
  type BriefFaq,
  type BriefFormality,
  type BriefItemChange,
  type BriefPillar,
  type BriefSection,
  type BriefService,
  type BriefSource,
  type BriefSuggestion,
  type BriefTextItem,
  type BriefVoice,
  type BriefVoiceChange,
  type BriefWarmth,
  type BriefWarning,
  type BusinessBrief,
  type BusinessBriefView,
} from "@/api";
import { formatDateTime } from "@/lib/datetime";
import { READ_ONLY_TEXT } from "@/lib/ai-settings/errors";

/* -------------------------------------------------------------------------- */
/* Sections and their items                                                    */
/* -------------------------------------------------------------------------- */

export const BRIEF_SECTIONS: readonly BriefSection[] = ["services", "differentiators", "faqs", "audience", "local", "pillars", "do_not_say"];

/** An item of any section. */
export type BriefItem = BriefService | BriefFaq | BriefPillar | BriefTextItem;

export type BriefSectionCopy = {
  title: string;
  description: string;
  /** "Add a service". */
  add: string;
  /** "service", for "Edit service", "Remove this service?". */
  noun: string;
  /** With no item in it. */
  empty: string;
};

export const BRIEF_SECTION_COPY: Record<BriefSection, BriefSectionCopy> = {
  services: {
    title: "Services",
    description: "What you offer. Posts about a service link to its page with a “Learn more” button.",
    add: "Add a service",
    noun: "service",
    empty: "No services yet.",
  },
  differentiators: {
    title: "What sets you apart",
    description: "Why customers pick you. The AI may say these as written.",
    add: "Add a point",
    noun: "point",
    empty: "Nothing yet.",
  },
  faqs: {
    title: "Questions customers ask",
    description: "Answers the AI may give in replies and posts.",
    add: "Add a question",
    noun: "question",
    empty: "No questions yet.",
  },
  audience: { title: "Who you serve", description: "The customers you write for.", add: "Add a group", noun: "group", empty: "Nothing yet." },
  local: { title: "Areas you serve", description: "Neighbourhoods and towns the AI may name.", add: "Add an area", noun: "area", empty: "Nothing yet." },
  pillars: {
    title: "Post themes",
    description: "Themes AI posts come back to, so your profile covers what matters to you.",
    add: "Add a theme",
    noun: "theme",
    empty: "No themes yet.",
  },
  do_not_say: {
    title: "Never say",
    description: "What the AI must never write for this business.",
    add: "Add a rule",
    noun: "rule",
    empty: "No rules yet.",
  },
};

/** The fields the owner can change, by section (`briefOwner.service.ts` SECTION_FIELDS). */
export type BriefFieldKey = "name" | "summary" | "details" | "audience" | "problems" | "seasonality" | "page_url" | "question" | "answer" | "description" | "text";

export const BRIEF_SECTION_FIELDS: Record<BriefSection, readonly BriefFieldKey[]> = {
  services: ["name", "summary", "details", "audience", "problems", "seasonality", "page_url"],
  faqs: ["question", "answer"],
  pillars: ["name", "description"],
  differentiators: ["text"],
  audience: ["text"],
  local: ["text"],
  do_not_say: ["text"],
};

/** What a new item of a section needs. */
export const BRIEF_REQUIRED_FIELDS: Record<BriefSection, readonly BriefFieldKey[]> = {
  services: ["name"],
  faqs: ["question", "answer"],
  pillars: ["name", "description"],
  differentiators: ["text"],
  audience: ["text"],
  local: ["text"],
  do_not_say: ["text"],
};

/** The backend's limits (`BRIEF_LIMITS`). */
export const BRIEF_LIMITS = { name: 80, summary: 400, detail: 200, details: 4, text: 300, question: 200, answer: 600, url: 2048, term: 40, vocabulary: 15, avoid: 10, ownerItems: 20 } as const;

export type BriefFieldCopy = { label: string; max: number; multiline?: boolean; list?: boolean; hint?: string; placeholder?: string };

/** A field's label, limit and kind (a list is one entry per line). `text` and `name` depend on the section. */
export function briefFieldCopy(section: BriefSection, key: BriefFieldKey): BriefFieldCopy {
  switch (key) {
    case "name":
      return section === "pillars"
        ? { label: "Theme", max: BRIEF_LIMITS.name, placeholder: "e.g. Spring readiness" }
        : { label: "Service", max: BRIEF_LIMITS.name, placeholder: "e.g. Drain cleaning" };
    case "summary":
      return { label: "What it is", max: BRIEF_LIMITS.summary, multiline: true };
    case "details":
      return { label: "Details", max: BRIEF_LIMITS.detail, list: true, hint: `One per line, up to ${BRIEF_LIMITS.details}.` };
    case "audience":
      return { label: "Who it's for", max: BRIEF_LIMITS.detail };
    case "problems":
      return { label: "Problems it solves", max: BRIEF_LIMITS.detail, list: true, hint: `One per line, up to ${BRIEF_LIMITS.details}.` };
    case "seasonality":
      return { label: "When people need it", max: BRIEF_LIMITS.detail, placeholder: "e.g. every spring" };
    case "page_url":
      return { label: "Its page on your website", max: BRIEF_LIMITS.url, hint: "For the “Learn more” button of posts about it. It must be on your own website.", placeholder: "https://" };
    case "question":
      return { label: "Question", max: BRIEF_LIMITS.question };
    case "answer":
      return { label: "Answer", max: BRIEF_LIMITS.answer, multiline: true };
    case "description":
      return { label: "What it covers", max: BRIEF_LIMITS.text, multiline: true };
    case "text":
      return { label: TEXT_LABEL[section], max: BRIEF_LIMITS.text, multiline: true };
  }
}

const TEXT_LABEL: Record<BriefSection, string> = {
  services: "Text",
  faqs: "Text",
  pillars: "Text",
  differentiators: "What sets you apart",
  audience: "Who you serve",
  local: "Area",
  do_not_say: "What the AI must never write",
};

/** The items of a section (shown and removed apart). */
export function sectionItems(brief: BusinessBrief, section: BriefSection): BriefItem[] {
  const items = (brief[section] ?? []) as BriefItem[];
  return Array.isArray(items) ? items : [];
}

/** An item's main line: a service's or theme's name, a question, or the text. */
export function briefItemTitle(section: BriefSection, item: BriefItem): string {
  const value =
    section === "services" || section === "pillars"
      ? (item as BriefService | BriefPillar).name
      : section === "faqs"
        ? (item as BriefFaq).question
        : (item as BriefTextItem).text;
  return value?.trim() || BRIEF_SECTION_COPY[section].noun;
}

/** "Edited by you", "Added by you", or null for the AI's own words. */
export function itemOwnerTag(item: BriefItem): string | null {
  if (item.origin === "owner") return "Added by you";
  if (item.locked) return "Edited by you";
  return null;
}

/* -------------------------------------------------------------------------- */
/* The edit form                                                               */
/* -------------------------------------------------------------------------- */

/** What the item dialog's fields hold (lists one entry per line). */
export type BriefItemForm = Record<BriefFieldKey, string>;

const EMPTY_FORM: BriefItemForm = {
  name: "",
  summary: "",
  details: "",
  audience: "",
  problems: "",
  seasonality: "",
  page_url: "",
  question: "",
  answer: "",
  description: "",
  text: "",
};

const LIST_FIELDS: readonly BriefFieldKey[] = ["details", "problems"];

/** The form of an item (or an empty one to add). */
export function briefItemForm(item: BriefItem | null): BriefItemForm {
  if (!item) return { ...EMPTY_FORM };
  const record = item as unknown as Record<string, unknown>;
  const form = { ...EMPTY_FORM };
  for (const key of Object.keys(EMPTY_FORM) as BriefFieldKey[]) {
    const value = record[key];
    if (Array.isArray(value)) form[key] = value.filter((x) => typeof x === "string").join("\n");
    else if (typeof value === "string") form[key] = value;
  }
  return form;
}

const linesOf = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** A field's value as the API takes it: a list of lines, or the trimmed text (null when empty, for optional fields). */
function fieldValue(key: BriefFieldKey, form: BriefItemForm): string | string[] | null {
  if (LIST_FIELDS.includes(key)) return linesOf(form[key]);
  return form[key].trim() || null;
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export type BriefFormErrors = Partial<Record<BriefFieldKey, string>>;

/** What to fix before saving: required fields, lengths, the number of list entries, an https page. */
export function briefFormErrors(section: BriefSection, form: BriefItemForm): BriefFormErrors {
  const errors: BriefFormErrors = {};
  for (const key of BRIEF_SECTION_FIELDS[section]) {
    const copy = briefFieldCopy(section, key);
    if (LIST_FIELDS.includes(key)) {
      const lines = linesOf(form[key]);
      if (lines.length > BRIEF_LIMITS.details) errors[key] = `Keep it to ${BRIEF_LIMITS.details} lines.`;
      else if (lines.some((line) => line.length > copy.max)) errors[key] = `Keep each line to ${copy.max} characters.`;
      continue;
    }
    const value = form[key].trim();
    if (!value && BRIEF_REQUIRED_FIELDS[section].includes(key)) errors[key] = "Fill this in.";
    else if (value.length > copy.max) errors[key] = `Keep it to ${copy.max.toLocaleString()} characters.`;
    else if (key === "page_url" && value && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value)) errors[key] = "Use the page's full address, starting with https://.";
  }
  return errors;
}

/**
 * The `PATCH` change for the form: an edit sends the fields that changed (the item is then locked: the owner's
 * words); an add sends the section's fields (no `id`). Null when an edit changes nothing.
 */
export function briefItemChange(section: BriefSection, item: BriefItem | null, form: BriefItemForm): BriefItemChange | null {
  const change: Record<string, unknown> = { section };
  if (item) change.id = item.id;
  const record = (item ?? {}) as unknown as Record<string, unknown>;
  let changed = false;
  for (const key of BRIEF_SECTION_FIELDS[section]) {
    const next = fieldValue(key, form);
    // An empty optional field reads as null, like the item's own null or "".
    if (item && sameValue(record[key] === "" ? null : record[key], next)) continue;
    if (!item && (next === null || (Array.isArray(next) && next.length === 0))) continue;
    change[key] = next;
    changed = true;
  }
  if (item && !changed) return null;
  return change as BriefItemChange;
}

/* -------------------------------------------------------------------------- */
/* Evidence and sources                                                        */
/* -------------------------------------------------------------------------- */

export type EvidenceView = { quote: string; url: string | null; title: string | null; research: boolean };

/** An item's quotes with the page each was found on. */
export function evidenceOf(evidence: readonly BriefEvidence[] | null | undefined, sources: readonly BriefSource[] | null | undefined): EvidenceView[] {
  const byId = new Map((sources ?? []).map((source) => [source.id, source]));
  return (evidence ?? [])
    .filter((entry) => entry && typeof entry.quote === "string" && entry.quote.trim())
    .map((entry) => {
      const source = byId.get(entry.source_id);
      return { quote: entry.quote.trim(), url: source?.url ?? null, title: source?.title?.trim() || null, research: source?.kind === "research" };
    });
}

/** "bytownpipe.example/services/drain-cleaning" for an address. */
export function pageLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

/** True for an address that opens in the browser (http or https). */
export function isWebUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

/* -------------------------------------------------------------------------- */
/* Voice                                                                       */
/* -------------------------------------------------------------------------- */

export const FORMALITY_OPTIONS: readonly BriefFormality[] = ["formal", "neutral", "casual"];
export const WARMTH_OPTIONS: readonly BriefWarmth[] = ["reserved", "warm", "very_warm"];
export const FORMALITY_COPY: Record<BriefFormality, string> = { formal: "Formal", neutral: "Neutral", casual: "Casual" };
export const WARMTH_COPY: Record<BriefWarmth, string> = { reserved: "Reserved", warm: "Warm", very_warm: "Very warm" };

export type VoiceForm = { formality: BriefFormality | null; warmth: BriefWarmth | null; vocabulary: string; avoid: string };

export function voiceForm(voice: BriefVoice | null | undefined): VoiceForm {
  return {
    formality: voice?.formality ?? null,
    warmth: voice?.warmth ?? null,
    vocabulary: (voice?.vocabulary ?? []).join(", "),
    avoid: (voice?.avoid ?? []).join(", "),
  };
}

/** Comma or line separated words, trimmed, each once. */
export function termsOf(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of text.split(/[,\n]/).map((part) => part.trim()).filter(Boolean)) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export function voiceErrors(form: VoiceForm): Partial<Record<"vocabulary" | "avoid", string>> {
  const errors: Partial<Record<"vocabulary" | "avoid", string>> = {};
  const vocabulary = termsOf(form.vocabulary);
  const avoid = termsOf(form.avoid);
  if (vocabulary.length > BRIEF_LIMITS.vocabulary) errors.vocabulary = `Keep it to ${BRIEF_LIMITS.vocabulary} words or phrases.`;
  else if (vocabulary.some((term) => term.length > BRIEF_LIMITS.term)) errors.vocabulary = `Keep each one to ${BRIEF_LIMITS.term} characters.`;
  if (avoid.length > BRIEF_LIMITS.avoid) errors.avoid = `Keep it to ${BRIEF_LIMITS.avoid} words or phrases.`;
  else if (avoid.some((term) => term.length > BRIEF_LIMITS.term)) errors.avoid = `Keep each one to ${BRIEF_LIMITS.term} characters.`;
  return errors;
}

/** The voice the owner sets (it is then locked: rebuilds keep it). */
export function voiceChange(form: VoiceForm): BriefVoiceChange {
  return { formality: form.formality, warmth: form.warmth, vocabulary: termsOf(form.vocabulary), avoid: termsOf(form.avoid) };
}

/** True when the form differs from the voice in force. */
export function voiceChanged(voice: BriefVoice | null | undefined, form: VoiceForm): boolean {
  const current = voiceForm(voice);
  return (
    current.formality !== form.formality ||
    current.warmth !== form.warmth ||
    !sameValue(termsOf(current.vocabulary), termsOf(form.vocabulary)) ||
    !sameValue(termsOf(current.avoid), termsOf(form.avoid))
  );
}

/* -------------------------------------------------------------------------- */
/* Suggestions                                                                 */
/* -------------------------------------------------------------------------- */

const SUGGESTION_KIND_COPY: Record<string, string> = {
  years: "Years in business",
  licence: "Licence",
  certification: "Certification",
  award: "Award",
  membership: "Membership",
  other: "Proof point",
  known_for: "Known for",
  specialty: "Specialty",
  area: "Area served",
  presence: "Where it's listed",
  local_context: "Local context",
};

export function suggestionKindText(kind: string): string {
  return SUGGESTION_KIND_COPY[kind] ?? "Suggestion";
}

export type SuggestionRow = BriefSuggestion & { group: "proof_points" | "research" };

/** Proof points and research, waiting ones first. */
export function suggestionRows(brief: BusinessBrief): { pending: SuggestionRow[]; decided: SuggestionRow[] } {
  const all: SuggestionRow[] = [
    ...(brief.proof_points ?? []).map((item) => ({ ...item, group: "proof_points" as const })),
    ...(brief.research ?? []).map((item) => ({ ...item, group: "research" as const })),
  ];
  return { pending: all.filter((item) => item.status === "suggested"), decided: all.filter((item) => item.status !== "suggested") };
}

/* -------------------------------------------------------------------------- */
/* Status, the website read and its warnings                                   */
/* -------------------------------------------------------------------------- */

/** Poll while a build is queued or running, or a refresh waits for one. */
export function briefIsBuilding(view: Pick<BusinessBriefView, "status" | "refresh"> | null | undefined): boolean {
  if (!view) return false;
  return view.status === "queued" || view.status === "building" || Boolean(view.refresh?.pending);
}

/** Why the last build failed (`build.last_status`), in plain words. */
export function buildFailureText(lastStatus: string | null | undefined): string {
  switch (lastStatus) {
    case "budget_reached":
      return "The AI's budget for today ran out before it finished. It tries again tomorrow, or read your website again then.";
    case "moderation_unavailable":
      return "A safety check couldn't run. Read your website again in a while.";
    case "nothing_to_build":
      return "Your website had nothing the AI could use. Check that your location's website is right.";
    case "organization_inactive":
      return "Your account isn't active, so the brief wasn't built.";
    default:
      return "Read your website again to try once more.";
  }
}

/** The website read's `site.status` when it isn't `ok`. */
export function siteStatusText(status: string | null | undefined): string | null {
  switch (status) {
    case null:
    case undefined:
    case "ok":
      return null;
    case "blocked_by_robots":
      return "Your website's robots.txt asks readers like ours to stay out, so the brief couldn't read it.";
    case "unreachable":
      return "Your website didn't answer when we tried to read it.";
    case "not_html":
      return "Your website's address doesn't lead to a web page.";
    case "spam_suspected":
      return "Your home page looks hacked (it has spam on it), so it was left out. Ask your web person to check it.";
    default:
      return "Your website couldn't be read the last time.";
  }
}

/** One thing the site read noticed. */
export function warningText(warning: BriefWarning): string {
  const page = warning.url ? ` (${pageLabel(warning.url)})` : "";
  switch (warning.code) {
    case "javascript_only":
      return "Your website shows nothing without JavaScript, so the brief has little from it.";
    case "blocked_by_robots":
      return `Your website's robots.txt keeps our reader out of some pages${page}.`;
    case "robots_unreachable":
      return "Your website's robots.txt didn't answer, so nothing more was read.";
    case "robots_too_complex":
      return "Your website's robots.txt is far more complex than usual, so nothing more was read.";
    case "page_failed":
      return `A page couldn't be read${page}.`;
    case "time_limit":
      return "Reading took too long, so some pages were left out.";
    case "spam_suspected":
      return `A page looks hacked (it has spam on it) and was left out${page}.`;
    default:
      return `Something on your website couldn't be read${page}.`;
  }
}

/** The site's and the brief's warnings, each once. */
export function briefWarnings(view: BusinessBriefView): BriefWarning[] {
  const seen = new Set<string>();
  const out: BriefWarning[] = [];
  for (const warning of [...(view.site?.warnings ?? []), ...(view.brief?.warnings ?? [])]) {
    if (!warning || typeof warning.code !== "string") continue;
    const key = `${warning.code}|${warning.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(warning);
  }
  return out;
}

/** When "Read my website again" can be used next (a refresh is allowed once per 24 h), or null when it can now. */
export function refreshAllowedAt(view: BusinessBriefView, nowMs: number): string | null {
  const at = view.refresh?.next_allowed_at;
  if (!at) return null;
  const ms = Date.parse(at);
  return Number.isFinite(ms) && ms > nowMs ? at : null;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export type BriefErrorCopy = {
  text: string;
  /** The field to show it next to (400 `invalid_change` with `field`). */
  field: string | null;
  /** The brief changed or is gone: read it again. */
  reload: boolean;
};

/** A failed `PATCH …/ai/brief`. */
export function briefChangeErrorText(err: unknown): BriefErrorCopy {
  if (!isApiError(err)) return { text: "Your change couldn't be saved. Try again.", field: null, reload: false };
  const data = apiErrorData(err);
  const field = typeof data.field === "string" ? data.field : null;
  switch (err.reason) {
    case "brief_changed":
      return { text: "The brief was rebuilt at the same moment. It's reloaded: try again.", field: null, reload: true };
    case "invalid_change":
      if (field === "page_url") return { text: "Use a page of your own website.", field, reload: false };
      return { text: field ? "This can't be saved as it is. Check it and try again." : "This change can't be made.", field, reload: false };
    case "too_many_items":
      return { text: `You can add up to ${BRIEF_LIMITS.ownerItems} of your own in each section. Remove one first.`, field: null, reload: false };
    case "brief_item_not_found":
      return { text: "This item is gone: the brief was rebuilt. It's reloaded.", field: null, reload: true };
    case "brief_not_available":
      return { text: "The business brief isn't switched on for this account yet.", field: null, reload: true };
    case "read_only":
      return { text: READ_ONLY_TEXT, field: null, reload: false };
    case "invalid_input":
      return { text: "Some of this is too long or in the wrong form. Check it and try again.", field: null, reload: false };
    default:
      return { text: "Your change couldn't be saved. Try again.", field: null, reload: err.status === 404 };
  }
}

/** A failed Confirm or Dismiss of a suggestion. */
export function suggestionErrorText(err: unknown): { text: string; reload: boolean } {
  if (!isApiError(err)) return { text: "This couldn't be saved. Try again.", reload: false };
  switch (err.reason) {
    case "already_confirmed":
      return { text: "It's one of your facts already (a teammate may have confirmed it). The brief is reloaded.", reload: true };
    case "too_many_facts":
      return { text: "This location has 100 facts, the most it can keep. Delete one in AI Settings first.", reload: false };
    case "suggestion_not_found":
      return { text: "This suggestion is gone: the brief was rebuilt. It's reloaded.", reload: true };
    case "brief_changed":
      return { text: "The brief was rebuilt at the same moment. It's reloaded: try again.", reload: true };
    case "brief_not_available":
      return { text: "The business brief isn't switched on for this account yet.", reload: true };
    case "read_only":
      return { text: READ_ONLY_TEXT, reload: false };
    default:
      return { text: "This couldn't be saved. Try again.", reload: err.status === 404 };
  }
}

/** A failed "Read my website again". */
export function refreshErrorText(err: unknown): { text: string; reload: boolean } {
  if (!isApiError(err)) return { text: "Reading your website couldn't start. Try again.", reload: false };
  const next = apiErrorData(err).next_allowed_at;
  switch (err.reason) {
    case "refresh_too_soon":
      return {
        text: typeof next === "string" ? `Your website was read in the last 24 hours. You can read it again after ${formatDateTime(next)}.` : "Your website was read in the last 24 hours. Try again tomorrow.",
        reload: true,
      };
    case "brief_not_available":
      return { text: "The business brief isn't switched on for this account yet.", reload: true };
    case "ai_not_configured":
      return { text: "The AI isn't switched on yet. Try again later.", reload: false };
    case "refresh_not_queued":
      return { text: "Reading your website couldn't start. Nothing was used up: try again.", reload: false };
    case "subscription_required":
      return { text: "Reading your website again needs an active subscription.", reload: false };
    case "organization_suspended":
      return { text: "This account is suspended. Contact support.", reload: false };
    case "read_only":
      return { text: READ_ONLY_TEXT, reload: false };
    default:
      return { text: "Reading your website couldn't start. Try again.", reload: false };
  }
}
