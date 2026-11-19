/**
 * What a posts page's editor shows.
 *
 * Since post writer v2 (Phase 25c) "Write with AI" saves the post itself, in a background run: when the run is
 * done, its `result.post` opens in the editor as any saved post, with the run, so the editor can say what the AI
 * left out ("We left out: …"), offer the statements it couldn't use as facts, and say what happened to the
 * picture. Nothing is handed over unsaved any more.
 */
import type { Post, PostAiRun } from "@/api";

/** A new post (optionally with the AI panel open), or an existing one (optionally with the run that just wrote or changed it). */
export type PostEditorTarget = { kind: "new"; aiOpen?: boolean } | { kind: "edit"; post: Post; run?: PostAiRun | null };
