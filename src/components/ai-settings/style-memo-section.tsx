import { useState } from "react";
import { Eye, EyeOff, Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import type { AiSettings } from "@/api";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { StatusBadge } from "@/components/layout/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";
import { settingsErrorText } from "@/lib/ai-settings/errors";
import { STYLE_MEMO_SCOPE_COPY, styleMemoFollowedText, styleMemoRows, styleMemoUpdate, type StyleMemoRow } from "@/lib/ai-settings/style-memo";
import { useUpdateAiSettings } from "@/lib/ai-settings/use-ai-settings";
import { cn } from "@/lib/utils";

/**
 * "What the AI learned from your edits" (`#style`, Phase 25b's style memo): short preferences the AI noticed in how
 * the team edits its review replies (learned every 10 replies a person sends). Each has "Don't use" (it stays listed
 * so it is never learned again) and "Use again"; each click saves at once. A note for one kind of review carries
 * that kind as a tag. Read-only for a client user.
 */
export function StyleMemoSection({ locationId, view, canEdit }: { locationId: string; view: AiSettings; canEdit: boolean }) {
  const update = useUpdateAiSettings(locationId);
  // The notes being saved (each click is its own request).
  const [saving, setSaving] = useState<ReadonlySet<string>>(() => new Set());
  const rows = styleMemoRows(view.style_memo);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        tone="ai"
        compact
        title="Nothing learned yet"
        description={
          canEdit
            ? "Every 10 replies your team sends, the AI looks at how you changed its drafts and notes your preferences here, like “Sign off with the first name only”."
            : "Every 10 replies sent, the AI looks at how its drafts were changed and notes the preferences here."
        }
      />
    );
  }

  const toggle = async (row: StyleMemoRow, use: boolean) => {
    setSaving((current) => new Set(current).add(row.id));
    try {
      await update.mutateAsync(styleMemoUpdate(row.id, use));
      toast.success(use ? "The AI follows this note again." : "The AI won't follow this note. It stays listed so it isn't learned again.");
    } catch (err) {
      toast.error(settingsErrorText(err, "This note couldn't be changed. Try again."));
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(row.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {styleMemoFollowedText(rows)}
        {view.style_memo?.updated_at ? ` Last updated ${formatDate(view.style_memo.updated_at)}.` : ""}
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {rows.map((row) => (
          <li key={row.id} className={cn("flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4", row.dismissed && "bg-surface-strong")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={row.scope ? "info" : "neutral"} size="sm">
                  {STYLE_MEMO_SCOPE_COPY[row.scope ?? "all"]}
                </StatusBadge>
                {row.dismissed ? (
                  <StatusBadge tone="neutral" size="sm" icon={EyeOff}>
                    Not used
                  </StatusBadge>
                ) : null}
              </div>
              <p className={cn("mt-1 break-words text-sm", row.dismissed ? "text-muted-foreground" : "text-foreground")}>{row.text}</p>
            </div>
            {canEdit ? (
              <Button
                type="button"
                variant={row.dismissed ? "outline" : "ghost"}
                size="sm"
                disabled={saving.has(row.id)}
                aria-busy={saving.has(row.id) || undefined}
                aria-label={`${row.dismissed ? "Use again" : "Don't use"}: ${row.text}`}
                onClick={() => void toggle(row, row.dismissed)}
                className="self-start sm:self-auto"
              >
                {saving.has(row.id) ? <Loader2 aria-hidden className="animate-spin" /> : row.dismissed ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                {row.dismissed ? "Use again" : "Don't use"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
