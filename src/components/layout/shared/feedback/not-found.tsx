import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, LifeBuoy, MapPin, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Page-level "this page does not exist" state. Deliberately plain: it is a
 * wayfinding screen, not a marketing page. It offers the places people usually meant.
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
        "mx-auto w-full max-w-xl rounded-xl border border-border bg-card px-6 py-10 text-center shadow-card sm:px-10",
        className,
      )}
    >
      <span aria-hidden className="mx-auto block w-fit rounded-full bg-muted/70 p-1.5">
        <span className="grid size-12 place-items-center rounded-full bg-brand-tint text-primary ring-1 ring-inset ring-primary/20">
          <SearchX className="size-6" aria-hidden />
        </span>
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-primary">Error 404</p>
      <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button asChild>
          <Link to="/dashboard">
            <LayoutDashboard aria-hidden /> Go to dashboard
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/locations">
            <MapPin aria-hidden /> Locations
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/help">
            <LifeBuoy aria-hidden /> Help &amp; support
          </Link>
        </Button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") window.history.back();
        }}
        className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-hidden hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden /> Go back
      </button>
    </div>
  );

  if (!standalone) return card;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {card}
    </main>
  );
}
