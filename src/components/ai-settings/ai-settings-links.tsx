import { Link } from "react-router-dom";
import { ArrowRight, BookOpenText, Images, Lightbulb, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { AiFactsList, AiReadiness, AiSettings } from "@/api";
import { SectionHeader } from "@/components/layout/shared/data-display";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { useAiReadiness } from "@/lib/ai-readiness/use-readiness";
import { useAiFacts, useAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { locationPath } from "@/lib/mypageseo/section-links";
import { useAutoReplyFeature } from "@/lib/reviews/auto-reply";

const COUNT = new Intl.NumberFormat("en-US");
const plural = (n: number, one: string, many: string) => `${COUNT.format(n)} ${n === 1 ? one : many}`;

/**
 * One line about the settings in force: what the user set, else that the defaults apply. Automatic replies (the
 * settings' read-only `auto_reply`) count only while their switch is on (`autoRepliesLive`): otherwise none go out.
 */
function settingsStat(view: AiSettings, autoRepliesLive: boolean): string {
  const parts: string[] = [];
  if (view.settings.restricted) parts.push("Restricted mode on");
  if (autoRepliesLive && view.auto_reply?.enabled) parts.push(view.auto_reply.paused ? "automatic replies paused" : "automatic replies on");
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
  return `${COUNT.format(list.total)} added · ${COUNT.format(seen)} the AI can use now`;
}

function briefStat(readiness: AiReadiness): string | null {
  const brief = readiness.details?.brief;
  if (!brief) return null;
  if (brief.status === "queued" || brief.status === "building") return "Reading your website now";
  if (brief.status === "failed") return "It couldn't be built: read your website again";
  if (brief.status === "none" || brief.version === null) return "Not built yet";
  const pending = brief.suggestions_pending > 0 ? ` · ${plural(brief.suggestions_pending, "suggestion", "suggestions")} to confirm` : "";
  return `${plural(brief.facts, "fact", "facts")} from your website${pending}`;
}

function photosStat(readiness: AiReadiness): string | null {
  const photos = readiness.details?.photos;
  if (!photos) return null;
  if (photos.library === 0) return "No photos yet";
  return `${plural(photos.library, "photo", "photos")} · ${COUNT.format(photos.usable)} ready to use`;
}

/**
 * On AI Studio: what the AI goes by for this location: "AI Settings" (how it writes), "Facts for the AI" (what it may
 * state), the "Business brief" (what the website says; only while it's switched on) and the "Photo library" (the
 * photos AI posts use first). Quiet link cards (no filled button), each with a line of live data once it has loaded;
 * nothing shows in its place when the read fails. Automatic replies are named only while their switch is on.
 */
export function AiSettingsLinks({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const settings = useAiSettings(locationId);
  const facts = useAiFacts(locationId);
  const readiness = useAiReadiness(locationId);
  // The server's switch for automatic replies (`feature`): until it's on they don't exist, so nothing names them.
  const autoRepliesOn = useAutoReplyFeature(locationId) === "on";
  const briefOn = Boolean(readiness.data?.checks?.brief?.available);
  return (
    <section aria-label="What the AI goes by" className="space-y-4">
      <SectionHeader
        title="What the AI goes by"
        description="How the AI writes for this business, what it may state, and the photos it uses. Free: no tokens."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsLinkCard
          icon={SlidersHorizontal}
          title="AI Settings"
          description={`House rules, signature and contact line for replies${autoRepliesOn ? ", automatic replies" : ""}, restricted mode, your logo and images in AI posts.`}
          stat={settings.data ? settingsStat(settings.data, autoRepliesOn) : null}
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
        {briefOn ? (
          <SettingsLinkCard
            icon={BookOpenText}
            title="Business brief"
            description="What your website says about your services, FAQs and what sets you apart, checked so the AI can be specific."
            stat={readiness.data ? briefStat(readiness.data) : null}
            to={locationPath(locationId, "ai/brief")}
            cta={canEdit ? "Open the brief" : "See the brief"}
          />
        ) : null}
        <SettingsLinkCard
          icon={Images}
          title="Photo library"
          description="Photos of your work, team and place. AI posts use a fitting one first, before making a picture."
          stat={readiness.data ? photosStat(readiness.data) : null}
          to={locationPath(locationId, "ai/photos")}
          cta={canEdit ? "Add photos" : "See photos"}
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
