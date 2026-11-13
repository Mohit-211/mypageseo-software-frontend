/**
 * Handing an AI draft to the post editor.
 *
 * The AI writer (`src/components/posts/ai-writer.tsx`) never saves anything: picking a draft opens
 * `PostEditor` seeded with it, where the person adds a photo (or an AI image from the draft's
 * `image_idea`), then saves, schedules or publishes. Phase 25b will make `ai-draft` save a draft post
 * itself; the editor can then open that post instead, with no change to the writer's callers.
 */
import type { AiPostDraft, Post, PostType } from "@/api";

/** What the writer knew when it wrote the drafts. */
export type AiDraftContext = {
  type: PostType;
  topic: string;
  keywords: string[];
};

/** A new post started from an AI draft. */
export type PostSeed = AiDraftContext & { draft: AiPostDraft };

/** What a post page's editor is showing: a new post (optionally from an AI draft, or with the AI writer open) or an existing one. */
export type PostEditorTarget =
  | { kind: "new"; seed?: PostSeed; aiOpen?: boolean }
  | { kind: "edit"; post: Post };
