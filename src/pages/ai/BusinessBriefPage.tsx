import { Link } from "react-router-dom";
import { ArrowLeft, BookOpenText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { BusinessBriefView } from "@/api";
import { BriefSectionCard } from "@/components/ai-brief/brief-section-card";
import { BriefPagesRead, BriefStatusNotes } from "@/components/ai-brief/brief-site";
import { BriefSuggestions } from "@/components/ai-brief/brief-suggestions";
import { BriefVoiceCard } from "@/components/ai-brief/brief-voice";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/hooks/use-access";
import { useNow } from "@/hooks/use-now";
import { READ_ONLY_TEXT, isNotAvailableYet } from "@/lib/ai-settings/errors";
import { BRIEF_SECTIONS, briefIsBuilding, buildFailureText, refreshAllowedAt, refreshErrorText, sectionItems, suggestionRows } from "@/lib/ai-brief/brief";
import { useBriefMutations, useBusinessBrief } from "@/lib/ai-brief/use-brief";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";

const COUNT = new Intl.NumberFormat("en-US");

/** "Version 3 · built Nov 16 · 14 facts the AI may use · your changes Nov 17". */
function metaLine(view: BusinessBriefView): string | null {
  const brief = view.brief;
  if (!brief) return null;
  return [
    `Version ${brief.version}`,
    brief.built_at ? `built ${formatDate(brief.built_at)}` : null,
    `${COUNT.format(brief.facts)} ${brief.facts === 1 ? "fact" : "facts"} the AI may use`,
    brief.edited_at ? `your changes ${formatDate(brief.edited_at)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * "Business brief" (`/locations/:locationId/ai/brief`, Phase 25b): what the business's own website says about it,
 * read and checked for the AI so replies and posts can be specific without inventing anything. Free, no tokens;
 * shown only while the server's switch is on (else "Coming soon"). Linked from AI Settings and the readiness
 * checklist.
 *
 * - Suggestions to confirm or dismiss lead; then each section with its quotes, the voice, and where it all came from.
 * - Owners and members correct, add, remove and reset items and set the voice (rebuilds keep the owner's words), and
 *   "Read my website again" (once a day; polled while it builds). A client user reads it.
 */
function BusinessBriefPage() {
  const { location } = useLocationRoute();
  const id = location.location_id;
  const canEdit = useCanEdit();
  const query = useBusinessBrief(id);
  const { refresh } = useBriefMutations(id);
  const now = useNow(30_000);
  const view = query.data;

  const building = briefIsBuilding(view);
  const allowedAt = view ? refreshAllowedAt(view, now) : null;
  const switchedOn = view?.feature === "on";
  const canRefresh = canEdit && switchedOn && !building && !allowedAt;

  const readAgain = () =>
    refresh.mutate(undefined, {
      onSuccess: (answer) =>
        toast.success(
          answer && answer.reads_website === false
            ? "Building your brief from web research: your location has no website. This can take a few minutes."
            : "Reading your website again. This can take a few minutes; you can leave this page.",
        ),
      onError: (err) => toast.error(refreshErrorText(err).text),
    });

  const refreshButton =
    canEdit && switchedOn && view?.brief ? (
      <Button type="button" variant="outline" onClick={readAgain} disabled={!canRefresh || refresh.isPending} aria-busy={refresh.isPending || undefined}>
        {refresh.isPending || building ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />}
        {building ? "Reading your website…" : "Read my website again"}
      </Button>
    ) : undefined;

  const meta =
    view && switchedOn ? (
      <p className="text-xs text-muted-foreground">
        {[metaLine(view), allowedAt && canEdit && !building ? `You can read your website again after ${formatDateTime(allowedAt)}` : null].filter(Boolean).join(" · ")}
      </p>
    ) : undefined;

  return (
    <>
      <PageHeader
        icon={BookOpenText}
        tone="ai"
        title="Business brief"
        description={`What ${location.website ? "your website says" : "the web says"} about ${location.name}, checked so the AI can be specific without inventing anything. Free: no tokens.`}
        meta={meta}
        actions={refreshButton}
      />
      <BriefContent
        locationId={id}
        website={location.website}
        view={view}
        isPending={query.isPending}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        canEdit={canEdit}
        canRefresh={canRefresh}
        refreshing={refresh.isPending}
        onRefresh={readAgain}
      />
    </>
  );
}

function BriefContent({
  locationId,
  website,
  view,
  isPending,
  error,
  onRetry,
  canEdit,
  canRefresh,
  refreshing,
  onRefresh,
}: {
  locationId: string;
  website: string | null;
  view: BusinessBriefView | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  canEdit: boolean;
  canRefresh: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const back = (
    <Button asChild variant="outline">
      <Link to={locationPath(locationId, "ai/settings")}>
        <ArrowLeft aria-hidden /> AI Settings
      </Link>
    </Button>
  );

  if (!view) {
    if (isPending) {
      return (
        <div className="space-y-4">
          <SectionSkeleton lines={3} />
          <SectionSkeleton lines={5} />
        </div>
      );
    }
    if (isNotAvailableYet(error)) {
      return <EmptyState variant="coming-soon" tone="ai" title="The business brief isn't available yet" description="When it is, the AI reads your website and notes your services, FAQs and what sets you apart." action={back} />;
    }
    return <ErrorState description="The business brief couldn't be loaded. Nothing was changed." onRetry={onRetry} />;
  }

  if (view.feature !== "on") {
    return (
      <EmptyState
        variant="coming-soon"
        tone="ai"
        title="The business brief isn't switched on for your account yet"
        description="When it is, the AI reads your website and notes your services, FAQs and what sets you apart, each with the words found on the page, so its posts and replies can be specific."
        action={back}
      />
    );
  }

  const readButton = (label: string) =>
    canEdit ? (
      <Button type="button" onClick={onRefresh} disabled={!canRefresh || refreshing} aria-busy={refreshing || undefined}>
        {refreshing ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCw aria-hidden />} {label}
      </Button>
    ) : undefined;

  const brief = view.brief;
  if (!brief) {
    return (
      <div className="space-y-4">
        <BriefStatusNotes view={view} />
        {briefIsBuilding(view) ? null : view.status === "failed" ? (
          <ErrorState
            title="The brief couldn't be built"
            description={buildFailureText(view.build?.last_status)}
            action={canRefresh ? readButton("Read my website again") : undefined}
          />
        ) : (
          <EmptyState
            icon={BookOpenText}
            tone="ai"
            title="No brief yet"
            description={
              canEdit
                ? website
                  ? "The AI reads up to 16 pages of your website and notes your services, FAQs, who you serve and what sets you apart, each with the words it found. Free: no tokens."
                  : "Your location has no website, so the brief is built from what other websites say about you. Add your website to your location for a fuller brief."
                : "Your agency can have the AI read the business's website here."
            }
            action={canRefresh ? readButton(website ? "Read my website" : "Build it") : undefined}
          />
        )}
      </div>
    );
  }

  const suggestions = suggestionRows(brief);
  const sources = brief.sources ?? [];
  const card = (section: (typeof BRIEF_SECTIONS)[number], className?: string) => (
    <BriefSectionCard key={section} locationId={locationId} section={section} items={sectionItems(brief, section)} sources={sources} canEdit={canEdit} className={className} />
  );

  return (
    <div className="space-y-6">
      {canEdit ? null : <FormAlert tone="info" title={READ_ONLY_TEXT}>You can see what the AI read about the business and what it may say.</FormAlert>}
      <BriefStatusNotes view={view} />
      <BriefSuggestions locationId={locationId} pending={suggestions.pending} decided={suggestions.decided} sources={sources} canEdit={canEdit} />
      {card("services")}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {card("differentiators")}
        {card("faqs")}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {card("audience")}
        {card("local")}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {card("pillars")}
        {card("do_not_say")}
      </div>
      <BriefVoiceCard locationId={locationId} voice={brief.voice} canEdit={canEdit} />
      <BriefPagesRead view={view} />
    </div>
  );
}

export default BusinessBriefPage;
