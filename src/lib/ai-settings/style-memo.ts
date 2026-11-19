/**
 * The style memo (Phase 25b, `GET …/ai/settings` → `style_memo`): short preferences the AI learned from how the
 * owner edits its review replies (the `ai-style-memo` job, every 10 replies a person sends). The reply writer
 * follows the items that aren't dismissed (at most 8). "Don't use" is `PUT { style_memo: { dismiss: [id] } }`,
 * "Use again" `{ restore: [id] }`; a dismissed item stays listed so it is never learned again.
 *
 * A note learned for one kind of review starts with it ("For praise (4-5★ with nothing to fix):", "For a
 * reservation (3★, or 4-5★ with something to fix):", "For a complaint (1-2★):") and holds for that kind alone:
 * the list shows that as a tag, with the rest of the sentence as the note.
 */
import type { AiSettingsUpdate, AiStyleMemo } from "@/api";

/** How many notes the reply writer follows at a time. */
export const STYLE_MEMO_FOLLOWED_MAX = 8;

export type StyleMemoScope = "praise" | "reservation" | "complaint";

export type StyleMemoRow = {
  id: string;
  /** The note without its "For …:" prefix, starting with a capital. */
  text: string;
  dismissed: boolean;
  /** The kind of review it holds for; null: every reply. */
  scope: StyleMemoScope | null;
};

const SCOPE_PREFIXES: readonly { scope: StyleMemoScope; pattern: RegExp }[] = [
  { scope: "praise", pattern: /^for praise\b[^:]*:\s*/i },
  { scope: "reservation", pattern: /^for a reservation\b[^:]*:\s*/i },
  { scope: "complaint", pattern: /^for a complaint\b[^:]*:\s*/i },
];

/** The tag of a scoped note. */
export const STYLE_MEMO_SCOPE_COPY: Record<StyleMemoScope | "all", string> = {
  praise: "Praise · 4–5★",
  reservation: "Mixed · 3★, or 4–5★ with a fix",
  complaint: "Complaints · 1–2★",
  all: "Every reply",
};

const capitalized = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** One item as a row: its scope split off its text. */
export function styleMemoRow(item: AiStyleMemo["items"][number]): StyleMemoRow {
  const raw = item.text.trim();
  for (const { scope, pattern } of SCOPE_PREFIXES) {
    if (pattern.test(raw)) return { id: item.id, text: capitalized(raw.replace(pattern, "").trim()), dismissed: item.dismissed, scope };
  }
  return { id: item.id, text: raw, dismissed: item.dismissed, scope: null };
}

/** The rows in the backend's order (it lists them as learned). */
export function styleMemoRows(memo: AiStyleMemo | null | undefined): StyleMemoRow[] {
  return (memo?.items ?? []).filter((item) => item && typeof item.id === "string" && typeof item.text === "string").map(styleMemoRow);
}

/** The `PUT …/ai/settings` body for "Don't use" (`use: false`) or "Use again" (`use: true`). */
export function styleMemoUpdate(id: string, use: boolean): AiSettingsUpdate {
  return { style_memo: use ? { restore: [id] } : { dismiss: [id] } };
}

/** "The AI follows 3 of them." with the cap when more are kept than it follows. */
export function styleMemoFollowedText(rows: readonly StyleMemoRow[]): string {
  const kept = rows.filter((row) => !row.dismissed).length;
  if (kept === 0) return "The AI follows none of them now.";
  if (kept > STYLE_MEMO_FOLLOWED_MAX) return `The AI follows up to ${STYLE_MEMO_FOLLOWED_MAX} of the ${kept} you keep.`;
  return kept === 1 ? "The AI follows the one you keep." : `The AI follows the ${kept} you keep.`;
}
