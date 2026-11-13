import { Link } from "react-router-dom";
import logoMarkUrl from "@/assets/logo-mark.png";
import { cn } from "@/lib/utils";

/** The hexagon mark plus the live "MyPageSEO" wordmark (brand teal + signal red). */
function BrandLockup({ wordmark = true, className }: { wordmark?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* 160×143 source: explicit size so the band never shifts while it decodes. */}
      <img src={logoMarkUrl} alt="" width={40} height={36} decoding="async" className="h-9 w-auto shrink-0" />
      {wordmark ? (
        <span className="text-lg font-bold leading-none tracking-tight">
          <span className="text-brand">MyPage</span>
          <span className="text-brand-accent">SEO</span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * Top of the sidebar: a light band (the mark is dark and would disappear on the teal), the same
 * height as the page header so the two read as one top bar.
 */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      aria-label="MyPageSEO dashboard"
      className="flex h-14 shrink-0 items-center border-b border-border bg-card px-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <BrandLockup />
    </Link>
  );
}

/** The mark in the page header on small screens, where the sidebar is a drawer. */
export function HeaderBrand({ className }: { className?: string }) {
  return (
    <Link
      to="/dashboard"
      aria-label="MyPageSEO dashboard"
      className={cn("flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <BrandLockup wordmark={false} className="sm:hidden" />
      <BrandLockup className="hidden sm:flex" />
    </Link>
  );
}
