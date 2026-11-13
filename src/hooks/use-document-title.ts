import { useEffect, type RefObject } from "react";

const BRAND = "MyPageSEO";

/**
 * "Reviews · Harbor Dental – Downtown · MyPageSEO": the parts that are set, most specific first,
 * then the brand (left out when a part already names it, e.g. "Sign in to MyPageSEO").
 */
export function formatDocumentTitle(parts: readonly (string | null | undefined)[]): string {
  const named = parts.map((part) => part?.replace(/\s+/g, " ").trim()).filter((part): part is string => Boolean(part));
  if (!named.some((part) => part.includes(BRAND))) named.push(BRAND);
  return named.join(" · ");
}

/*
 * The last title a page set, for the shell's route announcer (AppLayout reads it with
 * useSyncExternalStore). `version` counts every set, so a page whose title equals the last
 * page's still counts as a new title.
 */
export type PageTitleSnapshot = { title: string; version: number };

let snapshot: PageTitleSnapshot = { title: "", version: 0 };
const listeners = new Set<() => void>();

function publish(title: string): void {
  snapshot = { title, version: snapshot.version + 1 };
  for (const listener of listeners) listener();
}

export function subscribeToPageTitle(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPageTitleSnapshot(): PageTitleSnapshot {
  return snapshot;
}

/** Sets the tab title; returns how to put back the one before (unless a newer page replaced ours since). */
function applyTitle(title: string): () => void {
  const previous = document.title;
  document.title = title;
  publish(title);
  return () => {
    if (document.title === title) document.title = previous;
  };
}

/**
 * Names the browser tab, the history list and bookmarks after the page (WCAG 2.4.2), e.g.
 * `useDocumentTitle([title, locationName])` → "Reviews · Harbor Dental – Downtown · MyPageSEO".
 * The title before is put back when the page goes away.
 */
export function useDocumentTitle(parts: readonly (string | null | undefined)[]): void {
  const title = formatDocumentTitle(parts);
  useEffect(() => applyTitle(title), [title]);
}

/**
 * The same for a screen whose name is its `<h1>` (the sign-in pages and other full-screen forms):
 * `title` when given, else the text of the first `<h1>` inside `container`, followed as it changes
 * (a form that turns into "Check your email").
 */
export function useHeadingDocumentTitle(container: RefObject<HTMLElement | null>, title?: string): void {
  useEffect(() => {
    const node = container.current;
    const before = document.title;
    let applied: string | null = null;
    const sync = () => {
      const next = formatDocumentTitle([title ?? node?.querySelector("h1")?.textContent ?? null]);
      if (next === applied) return;
      applied = next;
      document.title = next;
      publish(next);
    };
    sync();
    let observer: MutationObserver | null = null;
    if (!title && node) {
      observer = new MutationObserver(sync);
      observer.observe(node, { subtree: true, childList: true, characterData: true });
    }
    return () => {
      observer?.disconnect();
      if (applied !== null && document.title === applied) document.title = before;
    };
  }, [container, title]);
}
