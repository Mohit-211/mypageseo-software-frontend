import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  BookOpenText,
  Bot,
  CircleCheck,
  ImageIcon,
  Images,
  Lightbulb,
  MessageSquareText,
  NotebookPen,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
} from "lucide-react";
import type { AiSettings } from "@/api";
import { ReadinessChecklist } from "@/components/ai-readiness/readiness-checklist";
import { AutoRepliesCard } from "@/components/ai-settings/auto-replies-card";
import { FactsSection } from "@/components/ai-settings/facts-section";
import { ImageSettingsSection } from "@/components/ai-settings/image-settings-section";
import { LogoSection } from "@/components/ai-settings/logo-section";
import { ReplySettingsSection } from "@/components/ai-settings/reply-settings-section";
import { RestrictedModeSection } from "@/components/ai-settings/restricted-mode-section";
import { LeaveGuard, SettingsCard } from "@/components/ai-settings/settings-parts";
import { StyleMemoSection } from "@/components/ai-settings/style-memo-section";
import { PageHeader } from "@/components/layout/shared/data-display";
import { EmptyState, ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useAccess, useCanEdit } from "@/hooks/use-access";
import { useAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { READ_ONLY_TEXT, isNotAvailableYet } from "@/lib/ai-settings/errors";
import { useAiFacts, useAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { useAutoReply } from "@/lib/ai-settings/use-auto-reply";
import { useAiSettingsForm } from "@/lib/ai-settings/use-settings-form";
import { formatDate } from "@/lib/datetime";
import { useLocationRoute } from "@/lib/locations/location-route-context";
import { locationPath } from "@/lib/mypageseo/section-links";

/**
 * AI Settings (`/locations/:locationId/ai/settings`; the page's name is title case in the sidebar, the header and
 * the tab, like AI Studio, AI Posts and AI Review Replies): how MyPageSEO's AI writes for one location. The readiness
 * checklist ("Get the AI ready · N of M done") leads, then stacked sections with anchors: how replies sound
 * (`#replies`), what the AI learned from your edits (`#style`), automatic replies (`#auto-replies`, only while the
 * server's switch is on), restricted mode (`#restricted`), facts for the AI (`#facts`), your logo (`#logo`) and images
 * in AI posts (`#images`, with the image style). The header links to the business brief (while it's switched on) and
 * the photo library. No AI and no tokens. Owners and members edit (only the owner switches restricted mode off); a
 * client user sees everything read-only, apart from the automatic replies consent of their own client.
 */
function AiSettingsPage() {
  const { location } = useLocationRoute();
  const id = location.location_id;
  const canEdit = useCanEdit();
  const access = useAccess();
  const isOwner = access.role === "owner";
  const isAgency = access.accountType === "agency";
  const settings = useAiSettings(id);
  const facts = useAiFacts(id);
  const autoReply = useAutoReply(id);
  const readiness = useAiReadiness(id);
  const view = settings.data;
  const form = useAiSettingsForm(id, view);
  const showAutoReplies = autoReply.data?.feature === "on";
  const briefOn = Boolean(readiness.data?.checks?.brief?.available);

  const sections = [
    { id: "replies", label: "How replies sound" },
    { id: "style", label: "What the AI learned" },
    ...(showAutoReplies ? [{ id: "auto-replies", label: "Automatic replies" }] : []),
    { id: "restricted", label: "Restricted mode" },
    { id: "facts", label: "Facts for the AI" },
    { id: "logo", label: "Your logo" },
    { id: "images", label: "Images in AI posts" },
  ];

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
          title="AI Settings aren't available yet"
          description="You can set how the AI writes for this location once they're switched on."
        />
      );
    }
    return <ErrorState compact className="shadow-none" description="The AI settings couldn't be loaded. Nothing was changed." onRetry={() => void settings.refetch()} />;
  };

  const usedBy = (text: string) => (
    <StatusBadge tone="success" size="sm" icon={CircleCheck}>
      {text}
    </StatusBadge>
  );

  return (
    <>
      <PageHeader
        icon={SlidersHorizontal}
        tone="ai"
        title="AI Settings"
        description={`How MyPageSEO's AI writes for ${location.name}: the rules it follows, the facts it may use and how its pictures look.`}
        meta={view?.updated_at ? <p className="text-xs text-muted-foreground">Last changed {formatDate(view.updated_at)}</p> : undefined}
        actions={
          <>
            {briefOn ? (
              <Button asChild variant="outline">
                <Link to={locationPath(id, "ai/brief")}>
                  <BookOpenText aria-hidden /> Business brief
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to={locationPath(id, "ai/photos")}>
                <Images aria-hidden /> Photo library
              </Link>
            </Button>
          </>
        }
      >
        <nav aria-label="On this page" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
          <span className="mr-1 text-muted-foreground">On this page:</span>
          {sections.map((section) => (
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
          You can see the rules the AI follows for {location.name}, the facts it may use and how its pictures look.
        </FormAlert>
      )}

      <ReadinessChecklist locationId={id} locationName={location.name} canEdit={canEdit} />

      <SettingsCard
        id="replies"
        icon={MessageSquareText}
        title="How replies sound"
        description="The standing rules, signature and contact line of every AI review reply."
        badge={usedBy("Used by AI review replies")}
      >
        {withSettings((current) => (
          <ReplySettingsSection view={current} form={form} canEdit={canEdit} locationName={location.name} />
        ))}
      </SettingsCard>

      <SettingsCard
        id="style"
        icon={NotebookPen}
        title="What the AI learned from your edits"
        description="Short preferences the AI noticed in how your team edits its review replies. It follows the ones you keep."
        badge={usedBy("Used by AI review replies")}
      >
        {withSettings((current) => <StyleMemoSection locationId={id} view={current} canEdit={canEdit} />, 3)}
      </SettingsCard>

      {showAutoReplies && autoReply.data ? (
        <SettingsCard
          id="auto-replies"
          icon={Bot}
          title="Automatic replies"
          description="Replies to new 5★ reviews (and 4★ ones, if you choose) go out on Google without anyone pressing Send, 30 minutes to 3 hours after a review arrives, between 8 am and 8 pm. Anything less than clearly positive waits for a person."
        >
          <AutoRepliesCard locationId={id} view={autoReply.data} isAgency={isAgency} />
        </SettingsCard>
      ) : null}

      <SettingsCard
        id="restricted"
        icon={ShieldCheck}
        title="Restricted mode"
        description="Stricter replies for businesses where privacy comes first."
        badge={usedBy("Used by AI review replies")}
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
            ? "Your own facts, offers, events and contests. AI replies and posts state prices, offer dates and staff names only from here."
            : "The business's own facts, offers, events and contests. AI replies and posts state prices, offer dates and staff names only from here."
        }
        badge={usedBy("Used by AI replies and posts")}
      >
        <FactsSection locationId={id} facts={facts} canEdit={canEdit} />
      </SettingsCard>

      <SettingsCard
        id="logo"
        icon={Stamp}
        title="Your logo"
        description="It goes on your post pictures in a quiet corner, or in the band of a designed graphic. Free: no tokens."
        badge={usedBy("Used by AI posts")}
      >
        <LogoSection locationId={id} canEdit={canEdit} isAgency={isAgency} />
      </SettingsCard>

      <SettingsCard
        id="images"
        icon={ImageIcon}
        title="Images in AI posts"
        description="Where your logo goes, how pictures are finished, AI images and photo reuse."
        badge={usedBy("Used by AI posts")}
      >
        {withSettings((current) => (
          <ImageSettingsSection view={current} form={form} canEdit={canEdit} libraryLink={locationPath(id, "ai/photos")} />
        ))}
      </SettingsCard>

      <LeaveGuard when={canEdit && form.dirty} description="Your AI settings changes aren't saved yet." />
    </>
  );
}

export default AiSettingsPage;
