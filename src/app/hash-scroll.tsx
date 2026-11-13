import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Longest time a page may keep loading above its anchor before we stop following it. */
const FOLLOW_MS = 3_000;

/** The reader taking over: from then on the page scrolls only when they say so. */
const STOP_EVENTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Scrolls to the `#section` of a link (`/white-label#links`, `/keywords#groups`) and keeps it in
 * place while the page above it is still loading, since panels and lists that arrive later push
 * it down. The router's own scroll only tries once, when the section may not even exist yet.
 *
 * It acts when a link opens a page or a section (and on the first load), never on Back/Forward
 * (the router restores the reader's position there) or when only the `?search` changes (filters
 * on the same page), and it stops as soon as the reader scrolls, types or clicks.
 */
export function HashScroll() {
  const location = useLocation();
  const navigationType = useNavigationType();
  // The last location handled, so a re-run for the same one (React's development double run)
  // keeps its decision, and a search-only change can be told apart from opening the section.
  const last = useRef<{ key: string; target: string; follow: boolean } | null>(null);

  useEffect(() => {
    const target = `${location.pathname}${location.hash}`;
    let follow: boolean;
    if (last.current?.key === location.key) {
      follow = last.current.follow;
    } else {
      const searchOnly = last.current?.target === target;
      const opened = navigationType !== "POP" || location.key === "default";
      follow = Boolean(location.hash) && !searchOnly && opened;
      last.current = { key: location.key, target, follow };
    }
    if (!follow) return;

    const id = decodeURIComponent(location.hash.slice(1));
    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    const observer = new ResizeObserver(align);
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      for (const type of STOP_EVENTS) window.removeEventListener(type, stop);
    };
    align();
    observer.observe(document.body);
    for (const type of STOP_EVENTS) window.addEventListener(type, stop, { passive: true });
    const timer = window.setTimeout(stop, FOLLOW_MS);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [location.key, location.pathname, location.hash, navigationType]);

  return null;
}
