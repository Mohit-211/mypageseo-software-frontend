/**
 * "Open it" on a toast about a post (a run that wrote, changed or pictured it; 2026-11-17 entry, section 1): one
 * guarded way to open the post in the editor, wherever the person is when they select it. A toast outlives the page
 * that showed it (the Toaster is app-wide), so its button never relies on that page.
 *
 * - The post is open in the editor already (`usePostEditorOnScreen` knows each editor's post): "Open it" only closes
 *   its toast, and a toast about that post isn't shown at all: the editor shows how the run ended itself.
 * - Never over a window: while a post editor or any other window is open (ui/open-windows.ts), "Open it" says "Close
 *   the post you're editing first" (or "Close the open window first") and does nothing else; its toast waits until
 *   every window is closed, then shows again without a time limit. Read when the button is selected, and again once
 *   the post is read, never when the toast was made.
 * - On a page that hosts the editor for the post's location (Posts, AI Posts: `usePostOpenHost`), the post is read
 *   again (someone may have changed it since) and opens there.
 * - Anywhere else, it goes to the post's address on its own location's Posts page (`?post=<id>`: read by id and shown
 *   above the list), whose editor opens it once read. Only that page, reached for that post, takes it: the request
 *   waits in memory (a minute at most), never in the address, so Back, reload, other pages and later visits never
 *   open it.
 * - Its toast stays until the post shows (a leave question's "Stay" keeps it), and focus goes back to where it was
 *   before the toast had it, so the editor that opens keeps the focus.
 *
 * A sticky toast (`STICKY_TOAST`) steps aside while a window is open, so it never covers the window's buttons (e.g.
 * the editor's Schedule on a tablet), and comes back once every window is closed. Signing out, another user's session
 * and another organization close every post toast and drop an "Open it" on its way: they were about the previous one.
 */
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from "react";
import { toast, type ExternalToast } from "sonner";
import { getPost, getSessionSubject, subscribeToAccessToken, subscribeToSelectedOrganization, type Post, type PostAiRun } from "@/api";
import { subscribeToWindows, windowOnScreen } from "@/components/ui/open-windows";
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
 * is open).
 */
export function usePostEditorOnScreen(postId: string | null): void {
  useEffect(() => {
    const editor = { postId };
    editorsOnScreen.add(editor);
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
 * The post toasts on screen, or waiting out of sight (`held`) until every window is closed, by id. `show` shows one
 * again, without a time limit.
 */
const postToasts = new Map<string, { sticky: boolean; held: boolean; show: () => void }>();

/** Closes a post toast for good: its post showed, or it is about another account. */
function forgetToast(id: string | undefined): void {
  if (!id) return;
  postToasts.delete(id);
  toast.dismiss(id);
}

/** A post toast waits out of sight until every window is closed, then shows again without a time limit. */
function holdToast(id: string | undefined): void {
  const entry = id ? postToasts.get(id) : undefined;
  if (!id || !entry || entry.held) return;
  entry.sticky = true;
  entry.held = true;
  toast.dismiss(id);
}

// A window opened: the sticky toasts step aside. Every window closed (not one handing over to the next, nor React's
// second mount in development): they come back.
const stopWindowsWatch = subscribeToWindows(() => {
  if (windowOnScreen()) {
    for (const [id, entry] of postToasts) if (entry.sticky) holdToast(id);
    return;
  }
  setTimeout(() => {
    if (windowOnScreen()) return;
    for (const entry of postToasts.values()) {
      if (!entry.held) continue;
      entry.held = false;
      entry.show();
    }
  }, 0);
});

/**
 * A toast about a post, with "Open it" (`openPost`) when `target` is given. Not shown while that post is open in the
 * editor; a sticky one (`STICKY_TOAST`) waits while a window is open (see the file comment).
 */
export function toastPost(type: ToastType, title: string, options: ExternalToast & { id: string }, target: PostToOpen | null): void {
  const { id } = options;
  if (target && editorHolds(target.postId)) return;
  // Closed by the person (its close button, a swipe) or by its time limit: gone. Stepping aside isn't closing.
  const gone = () => {
    if (!postToasts.get(id)?.held) postToasts.delete(id);
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
  const sticky = options.duration === Number.POSITIVE_INFINITY;
  const entry = { sticky, held: false, show: () => show(true) };
  postToasts.set(id, entry);
  if (sticky && windowOnScreen()) entry.held = true;
  else show(sticky);
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

/** True when a post editor or another window is open: it says so, and the toast waits until every window is closed. */
function refused(toastId: string | undefined): boolean {
  const title = postEditorOnScreen() ? "Close the post you're editing first" : windowOnScreen() ? "Close the open window first" : null;
  if (!title) return false;
  toast.info(title, { id: "post-open-busy", description: "Then select “Open it” again." });
  holdToast(toastId);
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
        void getPost(locationId, postId).then(
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
        );
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
  stopWindowsWatch();
  stopSessionWatch();
  stopOrganizationWatch();
});
