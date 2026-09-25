import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Page-level "this page does not exist" state. Deliberately plain: it is a
 * wayfinding screen, not a marketing page.
 */
export function NotFoundScreen({
  title = "We couldn't find that page",
  description = "The page you requested doesn't exist, or the link you followed is out of date.",
  standalone = false,
  className,
}: {
  title?: string;
  description?: string;
  /** Render as a centred full-height screen (used outside the app shell). */
  standalone?: boolean;
  className?: string;
}) {
  const card = (
    <div
      className={cn(
        "mx-auto w-full max-w-xl rounded-lg border border-border bg-surface px-6 py-10 text-center shadow-card",
        className,
      )}
    >
      <SearchX className="mx-auto size-5 text-primary" aria-hidden />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Error 404
      </p>
      <h1 className="mt-1 text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="sm">
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/locations">Locations</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/help">Help &amp; support</Link>
        </Button>
      </div>
    </div>
  );

  if (!standalone) return card;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {card}
    </main>
  );
}
