/**
 * "Open it" on a toast about a post (a run that wrote, changed or pictured it; 2026-11-17 entry, section 1): one
 * guarded way to open the post in the editor, wherever the person is when they select it. A toast outlives the page
 * that showed it (the Toaster is app-wide), so its button never relies on that page.
 *
 * - The post is open in the editor already (`usePostEditorOnScreen` knows each editor's post): "Open it" only closes
 *   its toast, and a toast about that post isn't shown at all: the editor shows how the run ended itself.
 * - Never over a window: a toast with a button waits while a window is open (ui/toast-hold.ts), so "Open it" is
 *   pressed with none open. If one opened meanwhile (the post is read first): the phone navigation and the search give
 *   way (they close and the post opens); over a post editor or another window, "Open it" says "Close the post you're
 *   editing first" (or "Close the open window first") and does nothing else, and its toast comes back without a time
 *   limit once every window is closed. Read when the button is selected, and again once the post is read.
 * - On a page that hosts the editor for the post's location (Posts, AI Posts: `usePostOpenHost`), the post is read
 *   again (someone may have changed it since) and opens there.
 * - Anywhere else, it goes to the post's address on its own location's Posts page (`?post=<id>`: read by id and shown
 *   above the list), whose editor opens it once read. Only that page, reached for that post, takes it: the request
 *   waits in memory (a minute at most), never in the address, so Back, reload, other pages and later visits never
 *   open it.
 * - Its toast stays until the post shows (a leave question's "Stay" keeps it), and focus goes back to where it was
 *   before the toast had it, so the editor that opens keeps the focus. Pressed again meanwhile (a double click), it
 *   reads the post once and adds one history entry.
 *
 * Toasts about a post go for good once the person deals with that post: opened in the editor (however it was opened),
 * deleted or sent out from its card (`forgetPostToasts`). Signing out, another user's session and another organization
 * close every post toast and drop an "Open it" on its way: they were about the previous one.
 */
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { toast, type ExternalToast } from "sonner";
import { getPost, getSessionSubject, subscribeToAccessToken, subscribeToSelectedOrganization, type Post, type PostAiRun } from "@/api";
import { closeWindowsThatGiveWay, subscribeToWindows, windowOnScreen } from "@/components/ui/open-windows";
import { dismissToast } from "@/components/ui/toast-hold";
import { appNavigate } from "@/lib/app-navigation";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useToastPostError } from "./post-toasts";

/** A post to open, with the run that wrote or changed it (the editor shows the run's notes). */
export type PostToOpen = { locationId: string; postId: string; run: PostAiRun | null };

/**
 * A toast that stays until it is closed or acted on: a post that was scheduled no longer goes out ("Review it,
 * then schedule it again"). Runs take minutes, so the person may come back to the tab long after it ended.
 */
export const STICKY_TOAST = { duration: Number.POSITIVE_INFINITY, closeButton: true } as const;

/* -------------------------------------------------------------------------- */
/* Post editors on screen                                                       */
/* -------------------------------------------------------------------------- */

/** The open post editors, with the post each holds (null: a new post, not saved yet). */
const editorsOnScreen = new Set<{ postId: string | null }>();

/** Whether a post editor is open now. */
export function postEditorOnScreen(): boolean {
  return editorsOnScreen.size > 0;
}

function editorHolds(postId: string): boolean {
  for (const editor of editorsOnScreen) if (editor.postId === postId) return true;
  return false;
}

/**
 * Called by `PostEditor` with the post it holds: it counts as open while it is mounted (pages mount it only while it
 * is open). Opening a post covers its toasts ("Open it", "back in drafts"): they go for good.
 */
export function usePostEditorOnScreen(postId: string | null): void {
  useEffect(() => {
    const editor = { postId };
    editorsOnScreen.add(editor);
    if (postId) forgetPostToasts(postId);
    return () => {
      editorsOnScreen.delete(editor);
    };
  }, [postId]);
}

/* -------------------------------------------------------------------------- */
/* Post toasts                                                                  */
/* -------------------------------------------------------------------------- */

type ToastType = "success" | "info" | "warning" | "error";

/**
 * The post toasts on screen or waiting for the windows to close (ui/toast-hold.ts), by id: the post each is about
 * (null: none to open), and `stay` keeps one until it is closed.
 */
const postToasts = new Map<string, { postId: string | null; stay: () => void }>();

/** Closes a post toast for good: its post showed, the person dealt with it, or it is about another account. */
function forgetToast(id: string | undefined): void {
  if (!id) return;
  postToasts.delete(id);
  dismissToast(id);
}

/**
 * Closes for good every toast about this post: it is open in the editor, deleted, or sent out from its card ("back in
 * drafts" would be stale).
 */
export function forgetPostToasts(postId: string): void {
  for (const [id, entry] of [...postToasts]) if (entry.postId === postId) forgetToast(id);
}

/**
 * A toast about a post, with "Open it" (`openPost`) when `target` is given. Not shown while that post is open in the
 * editor; while a window is open it waits, as every toast with a button does (see the file comment).
 */
export function toastPost(type: ToastType, title: string, options: ExternalToast & { id: string }, target: PostToOpen | null): void {
  const { id } = options;
  if (target && editorHolds(target.postId)) return;
  // Closed by the person (its close button, a swipe) or by its time limit: gone. Waiting isn't closing.
  const gone = () => {
    postToasts.delete(id);
  };
  const show = (sticky: boolean) => {
    toast[type](title, {
      ...options,
      ...(sticky ? STICKY_TOAST : {}),
      onDismiss: gone,
      onAutoClose: gone,
      ...(target
        ? {
            action: {
              label: "Open it",
              onClick: (event: MouseEvent<HTMLButtonElement>) => {
                // Sonner keeps the toast (`openPost` closes it once the post shows), and focus goes back now to where
                // it was before the toast had it: later, sonner would take it back from the editor that opened.
                event.preventDefault();
                event.currentTarget.blur();
                openPost(target, id);
              },
            },
          }
        : {}),
    });
  };
  postToasts.set(id, { postId: target?.postId ?? null, stay: () => show(true) });
  show(false);
}

/* -------------------------------------------------------------------------- */
/* Opening a post                                                               */
/* -------------------------------------------------------------------------- */

type Host = { locationId: string; open: (target: PostToOpen, toastId: string | undefined) => void };

/** Mounted pages with a post editor, the newest last. */
const hosts = new Set<Host>();

/** "Open it" from elsewhere waits this long for the post's Posts page to open it. */
const HANDOFF_MS = 60_000;
let handoff: (PostToOpen & { toastId: string | undefined; until: number }) | null = null;

/** The posts being read for "Open it": pressed again meanwhile, it waits for that read. */
const reading = new Set<string>();

/**
 * True when a post editor or another window that may hold what was typed is open: it says so, and the toast stays
 * until it is closed (it waits while a window is open). The phone navigation and the search give way instead.
 */
function refused(toastId: string | undefined): boolean {
  let title: string;
  if (postEditorOnScreen()) title = "Close the post you're editing first";
  else if (!windowOnScreen() || closeWindowsThatGiveWay()) return false;
  else title = "Close the open window first";
  toast.info(title, { id: "post-open-busy", description: "Then select “Open it” again." });
  if (toastId) postToasts.get(toastId)?.stay();
  // Once every window is closed, "Open it" is back: the notice goes, so it doesn't sit in front of it.
  const stop = subscribeToWindows(() => {
    if (windowOnScreen()) return;
    stop();
    toast.dismiss("post-open-busy");
  });
  return true;
}

/** Opens a post in the editor (see the file comment). `toastId`: the toast whose "Open it" it is. */
export function openPost(target: PostToOpen, toastId?: string): void {
  if (editorHolds(target.postId)) {
    forgetToast(toastId);
    return;
  }
  if (refused(toastId)) return;
  let host: Host | null = null;
  for (const entry of hosts) if (entry.locationId === target.locationId) host = entry;
  if (host) {
    handoff = null;
    host.open(target, toastId);
  } else {
    handoff = { ...target, toastId, until: Date.now() + HANDOFF_MS };
    appNavigate(locationPath(target.locationId, "gbp/posts", `?post=${encodeURIComponent(target.postId)}`));
  }
}

/**
 * For a page with a post editor (Posts, AI Posts): "Open it" on a toast about one of this location's posts reads the
 * post again and `show`s it in this page's editor. `arrived`: the post the page's address names (the Posts page's
 * `?post=`), which "Open it" from another page brought the person to: it opens once read.
 */
export function usePostOpenHost(locationId: string, show: (post: Post, run: PostAiRun | null) => void, arrived: string | null = null): void {
  const toastError = useToastPostError();
  const latest = useRef({ show, toastError });
  useLayoutEffect(() => {
    latest.current = { show, toastError };
  });
  useEffect(() => {
    const host: Host = {
      locationId,
      open: ({ postId, run }, toastId) => {
        if (reading.has(postId)) return;
        reading.add(postId);
        void getPost(locationId, postId)
          .then(
            (post) => {
              // While it was read, the person may have opened that post, or another window.
              if (editorHolds(postId)) forgetToast(toastId);
              else if (!refused(toastId)) {
                latest.current.show(post, run);
                forgetToast(toastId);
              }
            },
            (err: unknown) => {
              latest.current.toastError(err, "That post couldn't be opened.");
              forgetToast(toastId);
            },
          )
          .finally(() => reading.delete(postId));
      },
    };
    hosts.add(host);
    const waiting = handoff;
    if (waiting && waiting.locationId === locationId && waiting.postId === arrived) {
      handoff = null;
      if (Date.now() <= waiting.until) host.open(waiting, waiting.toastId);
    }
    return () => {
      hosts.delete(host);
    };
  }, [locationId, arrived]);
}

/* -------------------------------------------------------------------------- */
/* Another account                                                              */
/* -------------------------------------------------------------------------- */

/** Every post toast closes and an "Open it" on its way is dropped: they were about the previous user or organization. */
function forgetPostOpens(): void {
  handoff = null;
  for (const id of [...postToasts.keys()]) forgetToast(id);
}

// Signed out (here, in another tab, or the session ended), or another user's session.
let sessionUser = getSessionSubject();
const stopSessionWatch = subscribeToAccessToken(() => {
  const next = getSessionSubject();
  if (next === sessionUser) return;
  sessionUser = next;
  forgetPostOpens();
});
// Another organization in this tab (the menu, a link's `?organization=`).
const stopOrganizationWatch = subscribeToSelectedOrganization(forgetPostOpens);
// Editing this file in development re-runs it: drop the old watchers rather than stacking them.
import.meta.hot?.dispose(() => {
  stopSessionWatch();
  stopOrganizationWatch();
});
