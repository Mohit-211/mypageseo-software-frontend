import { Link } from "react-router-dom";
import { ArrowRight, Gauge, MessageCircleQuestion, Radar, Swords, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { ComingSoon } from "@/components/layout/shared/feedback/coming-soon";
import { Button } from "@/components/ui/button";
import { locationPath, pickNavLocationId } from "@/lib/mypageseo/section-links";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const PLANNED: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: MessageCircleQuestion,
    title: "Mentions",
    text: "Whether ChatGPT, Gemini, Perplexity and Claude mention your business when people ask them about the services you offer, where you offer them.",
  },
  {
    icon: Gauge,
    title: "One score over time",
    text: "A single visibility score for AI answers, so you can see whether you're mentioned more often from month to month.",
  },
  {
    icon: Swords,
    title: "Competitors",
    text: "Which nearby businesses the assistants recommend instead of you, and how often.",
  },
];

/**
 * AI Visibility (`/ai-visibility`): planned, not built (backend PHASES "AI visibility"). Says what it
 * will measure and points to what AI already does today. No sample data, no controls.
 */
function AiVisibilityPage() {
  const { locations, activeLocation } = useWorkspace();
  const locationId = pickNavLocationId({ activeLocationId: activeLocation?.id, locationIds: locations.map((location) => location.id) });

  return (
    <>
      <PageHeader
        icon={Radar}
        tone="ai"
        title="AI Visibility"
        description="How AI assistants like ChatGPT, Gemini, Perplexity and Claude talk about your business."
        actions={
          locationId ? (
            <Button asChild variant="outline" size="sm">
              <Link to={locationPath(locationId, "ai")}>
                Open AI Studio <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <ComingSoon
        icon={Radar}
        tone="ai"
        title="AI Visibility is on the way"
        description="More and more people ask AI assistants which local business to choose. AI Visibility will show whether they recommend yours, and who they suggest instead."
      />
      <section aria-label="What AI Visibility will show" className="grid gap-4 md:grid-cols-3">
        {PLANNED.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-ai-surface text-ai ring-1 ring-inset ring-ai/20">
              <Icon className="size-[18px]" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}

export default AiVisibilityPage;
