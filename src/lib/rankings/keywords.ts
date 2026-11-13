/**
 * Moved to `@/lib/keywords/keywords` (keywords are shared by rankings, AI posts and AI replies).
 * Kept so older imports (the post editor) keep working; import from the new module in new code.
 */
export {
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MIN_KEYWORD_LENGTH,
  addKeywords,
  keywordKey,
  sameKeyword,
  type KeywordAddResult,
} from "@/lib/keywords/keywords";
