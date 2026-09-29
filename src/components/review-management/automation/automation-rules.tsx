import { useState } from "react";
import { ArrowRight, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { TableBody, TableCard, TableHead, TableRow, TableScroll, Th, tdClass } from "@/components/layout/shared/data-table";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { ConfirmDialog } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  REPLY_TONE_LABEL,
  describeRatings,
  describeSentiments,
  reviewActions,
  rulePublishesAutomatically,
  type AutomationRule,
  type ReplySettings,
} from "@/lib/reviews/review-management";
import { AddRuleModal, type RuleInput } from "./add-rule-modal";

function RuleConditions({ rule }: { rule: AutomationRule }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
      <span>{describeRatings(rule.ratings)}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="and" />
      <span>{describeSentiments(rule.sentiments)}</span>
    </span>
  );
}

function RuleAction({ rule, settings }: { rule: AutomationRule; settings: ReplySettings }) {
  const auto = rulePublishesAutomatically(rule, settings);
  return (
    <div className="space-y-1">
      <StatusBadge tone={auto ? "success" : "info"}>{auto ? "Auto reply" : "Require approval"}</StatusBadge>
      {rule.action === "auto_publish" && !auto ? <p className="text-[11px] text-muted-foreground">Held for approval by reply settings</p> : null}
      <p className="text-[11px] text-muted-foreground">{REPLY_TONE_LABEL[rule.tone]} tone</p>
    </div>
  );
}

function RuleStatus({ rule, onToggle }: { rule: AutomationRule; onToggle: (enabled: boolean) => void }) {
  const id = `rule-enabled-${rule.id}`;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm">
      <Switch id={id} checked={rule.enabled} onCheckedChange={onToggle} aria-label={`${rule.name} ${rule.enabled ? "active" : "paused"}`} />
      <span className={rule.enabled ? "text-foreground" : "text-muted-foreground"}>{rule.enabled ? "Active" : "Paused"}</span>
    </label>
  );
}

export function AutomationRules({
  locationId,
  rules,
  settings,
  automationEnabled,
}: {
  locationId: string;
  rules: AutomationRule[];
  settings: ReplySettings;
  automationEnabled: boolean;
}) {
  const [editor, setEditor] = useState<{ open: boolean; rule: AutomationRule | null; key: number }>({ open: false, rule: null, key: 0 });
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  const openEditor = (rule: AutomationRule | null) => setEditor((e) => ({ open: true, rule, key: e.key + 1 }));

  const submit = (input: RuleInput) => {
    reviewActions.saveRule(locationId, input, editor.rule?.id);
    toast.success(editor.rule ? "Rule updated" : "Rule added", { description: `“${input.name}” applies to new reviews from the next sync.` });
  };

  const toggle = (rule: AutomationRule, enabled: boolean) => {
    reviewActions.setRuleEnabled(locationId, rule.id, enabled);
    toast.success(enabled ? "Rule activated" : "Rule paused", { description: `“${rule.name}”` });
  };

  return (
    <section aria-label="Automation rules">
      <SectionHeader
        title="Automation Rules"
        description={automationEnabled ? "The first matching rule handles each new review." : "Rules run once automatic replies are turned on."}
        actions={
          rules.length ? (
            <Button size="sm" onClick={() => openEditor(null)}>
              <Plus aria-hidden /> Add Rule
            </Button>
          ) : null
        }
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No automation rules yet"
          description="Add a rule to reply to new reviews by star rating and sentiment."
          action={
            <Button onClick={() => openEditor(null)}>
              <Plus aria-hidden /> Add Rule
            </Button>
          }
        />
      ) : (
        <TableCard className={automationEnabled ? undefined : "opacity-80"}>
          <div className="hidden md:block">
            <TableScroll minWidth={760} label="Automation rules">
              <TableHead>
                <Th>Rule</Th>
                <Th>Conditions</Th>
                <Th>Action</Th>
                <Th>Status</Th>
                <Th align="right">Manage</Th>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <td className={`${tdClass} font-medium`}>{rule.name}</td>
                    <td className={tdClass}>
                      <RuleConditions rule={rule} />
                    </td>
                    <td className={tdClass}>
                      <RuleAction rule={rule} settings={settings} />
                    </td>
                    <td className={tdClass}>
                      <RuleStatus rule={rule} onToggle={(v) => toggle(rule, v)} />
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => openEditor(rule)}>
                          <Pencil aria-hidden /> Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-critical hover:text-critical" onClick={() => setDeleting(rule)}>
                          <Trash2 aria-hidden /> Delete
                        </Button>
                      </div>
                    </td>
                  </TableRow>
                ))}
              </TableBody>
            </TableScroll>
          </div>

          <ul className="divide-y divide-border md:hidden" aria-label="Automation rules">
            {rules.map((rule) => (
              <li key={rule.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  <RuleStatus rule={rule} onToggle={(v) => toggle(rule, v)} />
                </div>
                <RuleConditions rule={rule} />
                <RuleAction rule={rule} settings={settings} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-10" onClick={() => openEditor(rule)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <Button variant="outline" className="h-10 text-critical hover:text-critical" onClick={() => setDeleting(rule)}>
                    <Trash2 aria-hidden /> Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </TableCard>
      )}

      <AddRuleModal
        key={editor.key}
        open={editor.open}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        rule={editor.rule}
        defaultTone={settings.defaultTone}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this automation rule?"
        description={deleting ? `“${deleting.name}” will stop handling new reviews. Replies it already drafted or published aren't affected.` : ""}
        confirmLabel="Delete Rule"
        onConfirm={() => {
          if (!deleting) return;
          reviewActions.deleteRule(locationId, deleting.id);
          toast.success("Rule deleted", { description: `“${deleting.name}” was removed.` });
          setDeleting(null);
        }}
      />
    </section>
  );
}
