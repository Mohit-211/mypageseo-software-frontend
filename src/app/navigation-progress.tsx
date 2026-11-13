import { useEffect, useState } from "react";
import { useLocation, useNavigation } from "react-router-dom";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done";

/** Below this a navigation counts as instant and shows nothing, so quick clicks never blink. */
const SHOW_AFTER_MS = 120;
/** How long the finished bar takes to fill up and fade before it resets. */
const FINISH_MS = 450;

/**
 * A thin bar along the very top of the window while the next page is on its way (its code or
 * data is loading). The old page stays on screen meanwhile, so this is the only sign a click
 * worked. Search-only changes (filters, tabs, `?range=`) never show it.
 */
export function NavigationProgress() {
  const navigation = useNavigation();
  const { pathname } = useLocation();
  const busy = navigation.state !== "idle" && navigation.location !== undefined && navigation.location.pathname !== pathname;
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    // Start only after the delay; on finish, complete the bar if it was showing.
    const timer = window.setTimeout(
      () => setPhase((current) => (busy ? "running" : current === "running" ? "done" : current)),
      busy ? SHOW_AFTER_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(() => setPhase("idle"), FINISH_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        data-phase={phase}
        className={cn(
          "h-full origin-left rounded-r-full bg-gradient-to-r from-primary via-highlight to-primary motion-reduce:transition-none",
          // Fast at first, then a long crawl towards 90 % until the page is ready.
          phase === "running" && "scale-x-90 opacity-100 transition-[scale] duration-[10s] ease-[cubic-bezier(0.08,0.8,0.2,1)]",
          // Fill the rest, then fade out.
          phase === "done" && "scale-x-100 opacity-0 [transition:scale_200ms_ease-out,opacity_250ms_ease-in_200ms]",
          phase === "idle" && "scale-x-0 opacity-0 transition-none",
        )}
      />
    </div>
  );
}
