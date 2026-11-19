import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { BellRing, CalendarClock, LifeBuoy, Mail, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { DigestSettingCard } from "@/components/settings/digest-setting";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/hooks/use-access";
import { showDigestSetting, useDigestSetting } from "@/lib/ai/ai-digest";
import { useWriteBlock } from "@/lib/billing/write-block";

const TODAY: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Mail, title: "Account emails", text: "Email verification, password resets and team invitations." },
  { icon: CalendarClock, title: "Monthly emails", text: "A fresh PDF report emailed after each location's monthly refresh." },
  { icon: LifeBuoy, title: "Support replies", text: "Our team's answers to your tickets, also by email." },
];

/**
 * Notification preferences: the "Daily review email" (the AI review digest, behind its server switch: see
 * `src/lib/ai/ai-digest.ts` for when it shows), then what else already reaches you. The rest isn't built yet.
 */
function NotificationSettingsPage() {
  const access = useAccess();
  const block = useWriteBlock();
  const digest = useDigestSetting();
  // Changed here on this visit: the switch stays on screen when it is turned back on (see `showDigestSetting`).
  const [touchedDigest, setTouchedDigest] = useState(false);
  const digestSetting = digest.query.data;
  const showDigest = showDigestSetting(digestSetting, touchedDigest);
  const changeDigest = (enabled: boolean) => {
    setTouchedDigest(true);
    digest.mutation.mutate(enabled, {
      onSuccess: () => toast.success(enabled ? "The daily review email is on." : "The daily review email is off."),
      onError: () => toast.error("That didn't save. Try again."),
    });
  };
  // Agency staff set up monthly emails on White Label, everyone else on Reports; both open the
  // "Schedule an email" form from `?create=schedule` (not while the account can't create one).
  const schedulesPage = access.can("clients.view") ? "/white-label" : "/reports";
  const schedulesPath = `${schedulesPage}${block.blocked ? "" : "?create=schedule"}#schedules`;
  // Read-only people (client users) can't schedule anything, so they get no button for it.
  const canSchedule = access.can("workspace.edit");
  return (
    <div className="space-y-6">
      {showDigest && digestSetting ? <DigestSettingCard setting={digestSetting} saving={digest.mutation.isPending} onChange={changeDigest} /> : null}
      <EmptyState
        variant="coming-soon"
        icon={BellRing}
        tone="settings"
        title={showDigest ? "More notification settings are on the way" : "Notification settings are on the way"}
        description="Soon you'll choose which alerts reach you, such as ranking drops, new reviews and posts waiting for approval. Until then, the dashboard lists what needs attention."
        action={
          <Button asChild size="sm">
            <Link to="/dashboard">Open the dashboard</Link>
          </Button>
        }
        secondaryAction={
          canSchedule ? (
            <Button asChild size="sm" variant="outline">
              <Link to={schedulesPath}>Schedule an email</Link>
            </Button>
          ) : undefined
        }
      />
      <section aria-labelledby="notifications-today" className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 id="notifications-today" className="text-[15px] font-semibold text-foreground">
          What reaches you today
        </h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {TODAY.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex items-start gap-3 rounded-lg bg-surface-strong p-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-inset ring-border-strong">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{item.title}</span>
                  <span className="block text-sm text-muted-foreground">{item.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default NotificationSettingsPage;
