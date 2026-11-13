import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Building2, Crosshair, ExternalLink, Globe, Link2, Phone, Tag, Users, type LucideIcon } from "lucide-react";
import type { LocationHeader, LocationOverview } from "@/api";
import { ChangeCenterButton } from "@/components/location/change-center-dialog";
import { LocationAvatar, LocationStatusBadge } from "@/components/location/location-badges";
import { RatingStars } from "@/components/dashboard/figures";
import { STATUS_TONE_CLASSES } from "@/components/layout/shared/module-tone";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { formatDate } from "@/lib/datetime";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { addressLine, centerText, displayUrl, knownText, safeHref } from "@/lib/locations/location-text";
import { cn } from "@/lib/utils";

// The ::after pads the text link out to a finger-sized target without moving the layout.
const INLINE_ACTION =
  "relative inline-flex cursor-pointer items-center gap-1 rounded-sm text-sm font-semibold text-primary underline-offset-4 outline-hidden after:absolute after:-inset-x-1 after:-inset-y-2 after:content-[''] hover:text-primary-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring";

function Fact({ icon: Icon, label, children, className }: { icon: LucideIcon; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3 bg-card px-5 py-3.5", className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 min-w-0 text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/** The Google connection in one line, with the fix when there's one to make. */
function GoogleConnection({ location }: { location: LocationHeader }) {
  const { connect } = useGbpConnect();
  const canEdit = useCanEdit();
  const fix = (label: string) =>
    canEdit ? (
      <button type="button" onClick={() => connect()} className={INLINE_ACTION}>
        <Link2 aria-hidden className="size-3.5" /> {label}
      </button>
    ) : null;
  const dot = (tone: "success" | "warning" | "critical" | "neutral") => <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_TONE_CLASSES[tone].dot)} />;

  switch (location.status) {
    case "reconnect_required":
      return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 font-medium text-critical">{dot("critical")} Access refused by Google</span>
          {fix("Reconnect")}
        </span>
      );
    case "gbp_disconnected":
      return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2">
            {dot("warning")} Disconnected{location.gbp_disconnected_at ? ` on ${formatDate(location.gbp_disconnected_at)}` : ""}
          </span>
          {fix("Connect again")}
        </span>
      );
    default:
      return location.gbp_connected ? (
        <span className="inline-flex items-center gap-2">{dot("success")} Connected</span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-2 text-muted-foreground">{dot("neutral")} Not connected</span>
          {fix("Connect Google")}
        </span>
      );
  }
}

/**
 * Who this location is, at the top of its overview: name, category and address, rating, status,
 * client (agencies), the Google connection, website, phone and where rankings are measured from.
 * The header data is there at once (the location layout loaded it); the rating fills in with the
 * overview.
 */
export function LocationHero({ location, overview, className }: { location: LocationHeader; overview?: LocationOverview | undefined; className?: string }) {
  const canViewClients = useAccess().can("clients.view");
  const category = knownText(location.business_category);
  const address = addressLine(location);
  const website = safeHref(location.website);
  const phone = knownText(location.phone);
  const center = centerText(location.center);
  const reviews = overview?.reviews;
  const rating = reviews?.available ? reviews.rating : null;
  const reviewCount = reviews?.available ? reviews.count : null;

  return (
    <section aria-label="About this location" className={cn("@container relative min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      {/* The band fades out downwards too, so a tall identity block (a long name wrapping on a phone)
          never shows its bottom edge as a hard line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-br from-brand-tint via-brand-tint/50 to-transparent [mask-image:linear-gradient(to_bottom,black_35%,transparent)]"
      />
      <div className="relative flex items-start gap-4 p-5">
        <LocationAvatar name={location.name} size="lg" className="size-12 rounded-xl text-base @md:size-14 @md:rounded-2xl @md:text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="min-w-0 text-xl font-semibold leading-tight tracking-tight text-foreground">{location.name}</h2>
            <LocationStatusBadge status={location.status} />
          </div>
          {category || address ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {category ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Tag aria-hidden className="size-3.5 text-primary" />
                  {category}
                </span>
              ) : null}
              {/* The dot only separates them on one line; stacked (narrow) it would dangle. */}
              {category && address ? (
                <span aria-hidden className="hidden @lg:inline">
                  ·
                </span>
              ) : null}
              {address ? <span>{address}</span> : null}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {rating !== null ? (
              <span className="inline-flex items-center gap-2">
                <RatingStars rating={rating} />
                <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({reviewCount === null ? "no" : reviewCount.toLocaleString()} {reviewCount === 1 ? "review" : "reviews"})</span>
              </span>
            ) : null}
            {location.client ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Users aria-hidden className="size-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">Client</span>
                {canViewClients ? (
                  <Link to={`/clients/${encodeURIComponent(location.client.client_id)}`} className={cn(INLINE_ACTION, "min-w-0 truncate")}>
                    {location.client.name}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-foreground">{location.client.name}</span>
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="relative grid grid-cols-1 gap-px border-t border-border bg-border @lg:grid-cols-2 @5xl:grid-cols-4">
        <Fact icon={Building2} label="Google Business Profile">
          <GoogleConnection location={location} />
        </Fact>
        <Fact icon={Globe} label="Website">
          {website ? (
            <a href={website} target="_blank" rel="noreferrer" className={cn(INLINE_ACTION, "max-w-full")}>
              <span className="truncate">{displayUrl(website)}</span>
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span className="text-muted-foreground">Not on the profile</span>
          )}
        </Fact>
        <Fact icon={Phone} label="Phone">
          {phone ? (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={INLINE_ACTION}>
              {phone}
            </a>
          ) : (
            <span className="text-muted-foreground">Not on the profile</span>
          )}
        </Fact>
        <Fact icon={Crosshair} label="Rankings measured from">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="min-w-0 truncate" title={center ?? undefined}>
              {center ?? "Set during setup"}
            </span>
            {location.center?.source ? <ChangeCenterButton locationId={location.location_id} className="h-auto p-0 text-sm" /> : null}
          </span>
        </Fact>
      </dl>
    </section>
  );
}
