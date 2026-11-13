import { Link } from "react-router-dom";
import { ArrowRight, Lightbulb, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { AiFactsList, AiSettings } from "@/api";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { useAiFacts, useAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { locationPath } from "@/lib/mypageseo/section-links";

/** One line about the settings in force: what the user set, else that the defaults apply. */
function settingsStat(view: AiSettings): string {
  const parts: string[] = [];
  if (view.settings.restricted) parts.push("Restricted mode on");
  if (!view.is_default.house_rules) parts.push("house rules set");
  if (!view.is_default.signature) parts.push("signature set");
  if (!view.is_default.contact_line) parts.push("own contact line");
  if (parts.length === 0) return "Using the defaults";
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function factsStat(list: AiFactsList): string {
  if (list.total === 0) return "None added yet";
  const seen = list.facts.filter((fact) => fact.in_fact_sheet).length;
  return `${list.total.toLocaleString()} added · ${seen.toLocaleString()} the AI can use now`;
}

/**
 * On AI Studio: where to set how the AI writes ("AI Settings") and what it may state ("Facts for the
 * AI"). Two quiet link cards (no filled button), each with a line of live data once it has loaded;
 * nothing shows in its place when the read fails.
 */
export function AiSettingsLinks({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const settings = useAiSettings(locationId);
  const facts = useAiFacts(locationId);
  return (
    <section aria-label="Your rules for the AI" className="space-y-4">
      <SectionHeader
        title="Your rules for the AI"
        description="How the AI writes for this business, and the facts it may state. Free: no tokens."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsLinkCard
          icon={SlidersHorizontal}
          title="AI Settings"
          description="House rules, signature and contact line for replies, restricted mode, and images in AI posts."
          stat={settings.data ? settingsStat(settings.data) : null}
          to={locationPath(locationId, "ai/settings")}
          cta={canEdit ? "Open AI Settings" : "See AI Settings"}
        />
        <SettingsLinkCard
          icon={Lightbulb}
          title="Facts for the AI"
          description="Your facts, offers, events and contests. Prices, offer dates and staff names in AI text come only from here."
          stat={facts.data ? factsStat(facts.data) : null}
          to={locationPath(locationId, "ai/settings", "#facts")}
          cta={canEdit ? "Add facts" : "See facts"}
        />
      </div>
    </section>
  );
}

/** A white card that is one link (stretched): icon, title, what it holds, a live line and its call to action. */
function SettingsLinkCard({
  icon,
  title,
  description,
  stat,
  to,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  stat: string | null;
  to: string;
  cta: string;
}) {
  return (
    <article className="group relative flex min-w-0 items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] hover:border-ai/35 hover:shadow-raised has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background sm:p-5">
      <IconChip icon={icon} tone="ai" size="md" />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-6 text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        {stat ? <p className="mt-2 text-sm font-medium text-foreground">{stat}</p> : null}
        <Link
          to={to}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline"
        >
          {cta}
          <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0" />
        </Link>
      </div>
    </article>
  );
}
