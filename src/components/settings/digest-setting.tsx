import { MailCheck } from "lucide-react";
import type { DigestSettingAnswer } from "@/lib/ai/ai-digest";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/datetime";

/**
 * "Daily review email" (the AI review digest) in Settings › Notifications: one switch, the user's own, for every
 * organization they belong to. The page decides when it shows (`showDigestSetting`) and saves the change.
 */
export function DigestSettingCard({
  setting,
  saving,
  onChange,
}: {
  setting: DigestSettingAnswer;
  saving: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const offSince = !setting.enabled && setting.opted_out_at ? formatDate(setting.opted_out_at, "") : "";
  return (
    <section aria-labelledby="digest-setting-title" className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <IconChip icon={MailCheck} tone="ai" size="md" />
        <div className="min-w-0 flex-1">
          <h2 id="digest-setting-title" className="text-[15px] font-semibold leading-6 text-foreground">
            Daily review email
          </h2>
          <p id="digest-setting-description" className="text-sm text-muted-foreground">
            An email in the morning when AI posts are waiting for your review or new AI reply drafts are ready. Nothing
            new, no email.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {setting.enabled ? "On" : offSince ? `Off since ${offSince}` : "Off"} · for every organization you belong to
          </p>
        </div>
        {/* The 20px track has a 36px hit area on touch screens (the Switch's own). */}
        <Switch
          checked={setting.enabled}
          disabled={saving}
          aria-busy={saving || undefined}
          aria-labelledby="digest-setting-title"
          aria-describedby="digest-setting-description"
          onCheckedChange={onChange}
          className="mt-1"
        />
      </div>
    </section>
  );
}
