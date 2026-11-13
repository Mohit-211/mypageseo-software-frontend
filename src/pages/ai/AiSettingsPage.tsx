import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, Clock, ImageIcon, Lightbulb, MessageSquareText, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { AiSettings } from "@/api";
import { FactsSection } from "@/components/ai-settings/facts-section";
import { ImageSettingsSection } from "@/components/ai-settings/image-settings-section";
import { ReplySettingsSection } from "@/components/ai-settings/reply-settings-section";
import { RestrictedModeSection } from "@/components/ai-settings/restricted-mode-section";
import { LeaveGuard, SettingsCard } from "@/components/ai-settings/settings-parts";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { READ_ONLY_TEXT, isNotAvailableYet } from "@/lib/ai-settings/errors";
import { useAiFacts, useAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { useAiSettingsForm } from "@/lib/ai-settings/use-settings-form";
import { formatDate } from "@/lib/datetime";
import { useLocationRoute } from "@/lib/locations/location-route-context";

const SECTIONS = [
  { id: "replies", label: "How replies sound" },
  { id: "restricted", label: "Restricted mode" },
  { id: "facts", label: "Facts for the AI" },
  { id: "images", label: "Images in AI posts" },
] as const;

/**
 * AI Settings (`/locations/:locationId/ai/settings`, Phase 25a; the page's name is title case in the
 * sidebar, the header and the tab, like AI Studio, AI Posts and AI Review Replies): how MyPageSEO's AI
 * writes for one location, in four stacked sections with anchors: ① how replies sound (house rules, signature,
 * contact line; used by AI review replies now), ② restricted mode, ③ facts for the AI (facts, offers,
 * events and contests; AI posts use them from their next update), ④ images in AI posts (saved now).
 * No AI and no tokens. Owners and members edit (only the owner switches restricted mode off); a client
 * user sees everything read-only.
 */
function AiSettingsPage() {
  const { location } = useLocationRoute();
  const id = location.location_id;
  const canEdit = useCanEdit();
  const isOwner = useAccess().role === "owner";
  const settings = useAiSettings(id);
  const facts = useAiFacts(id);
  const view = settings.data;
  const form = useAiSettingsForm(id, view);

  /** A section that needs the settings: its content, a placeholder while they load, or why they didn't. */
  const withSettings = (render: (view: AiSettings) => ReactNode, lines = 4) => {
    if (view) return render(view);
    if (!settings.isError) return <SectionSkeleton lines={lines} className="border-0 p-0 shadow-none" />;
    if (isNotAvailableYet(settings.error)) {
      return (
        <EmptyState
          variant="unavailable"
          tone="ai"
          compact
          title="AI Settings arrive with the next update"
          description="You can set how the AI writes for this location once it's live."
        />
      );
    }
    return <ErrorState compact className="shadow-none" description="The AI settings couldn't be loaded. Nothing was changed." onRetry={() => void settings.refetch()} />;
  };

  const inUse = (
    <StatusBadge tone="success" size="sm" icon={CircleCheck}>
      Used by AI review replies
    </StatusBadge>
  );
  const comingToPosts = (
    <StatusBadge tone="info" size="sm" icon={Clock}>
      Coming to AI posts
    </StatusBadge>
  );

  return (
    <>
      <PageHeader
        icon={SlidersHorizontal}
        tone="ai"
        title="AI Settings"
        description={`How MyPageSEO's AI writes for ${location.name}: the rules it follows and the facts it may use.`}
        meta={view?.updated_at ? <p className="text-xs text-muted-foreground">Last changed {formatDate(view.updated_at)}</p> : undefined}
      >
        <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          <span className="mr-1 text-muted-foreground">On this page:</span>
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              to={{ hash: `#${section.id}` }}
              className="inline-flex min-h-9 items-center rounded-md px-2 font-medium text-primary underline-offset-2 outline-hidden hover:bg-accent hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      {canEdit ? null : (
        <FormAlert tone="info" title={READ_ONLY_TEXT}>
          You can see the rules the AI follows for {location.name} and the facts it may use.
        </FormAlert>
      )}

      <SettingsCard
        id="replies"
        icon={MessageSquareText}
        title="How replies sound"
        description="The standing rules, signature and contact line of every AI review reply."
        badge={inUse}
      >
        {withSettings((current) => (
          <ReplySettingsSection view={current} form={form} canEdit={canEdit} locationName={location.name} />
        ))}
      </SettingsCard>

      <SettingsCard
        id="restricted"
        icon={ShieldCheck}
        title="Restricted mode"
        description="Stricter replies for businesses where privacy comes first."
        badge={inUse}
      >
        {withSettings(
          (current) => (
            <RestrictedModeSection locationId={id} locationName={location.name} view={current} canEdit={canEdit} isOwner={isOwner} />
          ),
          2,
        )}
      </SettingsCard>

      <SettingsCard
        id="facts"
        icon={Lightbulb}
        title="Facts for the AI"
        description={
          canEdit
            ? "Your own facts, offers, events and contests. AI posts start using them in an upcoming update; you can add them now."
            : "The business's own facts, offers, events and contests. AI posts start using them in an upcoming update."
        }
        badge={comingToPosts}
      >
        <FactsSection locationId={id} facts={facts} canEdit={canEdit} />
      </SettingsCard>

      <SettingsCard
        id="images"
        icon={ImageIcon}
        title="Images in AI posts"
        description="Your logo, AI images and photo reuse. Saved now; AI posts use them in a coming update."
        badge={comingToPosts}
      >
        {withSettings((current) => (
          <ImageSettingsSection view={current} form={form} canEdit={canEdit} />
        ))}
      </SettingsCard>

      <LeaveGuard when={canEdit && form.dirty} description="Your AI settings changes aren't saved yet." />
    </>
  );
}

export default AiSettingsPage;
