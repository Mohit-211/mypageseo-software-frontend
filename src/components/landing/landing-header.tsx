import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Wordmark({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span
        className={cn(
          "grid size-7 place-items-center rounded-md text-xs font-bold",
          dark
            ? "bg-sidebar-primary-foreground text-sidebar"
            : "bg-primary text-primary-foreground",
        )}
      >
        M
      </span>
      <span
        className={cn(
          "text-sm font-semibold tracking-tight",
          dark ? "text-sidebar-primary-foreground" : "text-foreground",
        )}
      >
        Mypageseo
      </span>
    </Link>
  );
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Product">
          <a href="#product" className="transition-colors hover:text-foreground">Product</a>
          <a href="#capabilities" className="transition-colors hover:text-foreground">Features</a>
          <a href="#who" className="transition-colors hover:text-foreground">Who it&rsquo;s for</a>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
