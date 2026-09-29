import { useState } from "react";
import { Info } from "lucide-react";
import { FieldMessage, FormField } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AUTOMATION_ACTION_LABEL,
  REPLY_TONES,
  REPLY_TONE_LABEL,
  SENTIMENTS,
  SENTIMENT_LABEL,
  describeRatings,
  describeSentiments,
  ruleCoversNegative,
  type AutomationAction,
  type AutomationRule,
  type ReplyTone,
  type ReviewSentiment,
} from "@/lib/reviews/review-management";
import { StarRating } from "../review-ui";

export type RuleInput = Omit<AutomationRule, "id" | "createdAt">;

const RATINGS = [5, 4, 3, 2, 1];

type Errors = Partial<Record<"name" | "ratings", string>>;

const optionClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-brand-tint";

/** Create a rule, or edit one when `rule` is given. The parent remounts it (via `key`) for each open. */
export function AddRuleModal({
  open,
  onOpenChange,
  rule,
  defaultTone,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
  defaultTone: ReplyTone;
  onSubmit: (input: RuleInput) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [ratings, setRatings] = useState<number[]>(rule?.ratings ?? [5, 4]);
  const [sentiments, setSentiments] = useState<ReviewSentiment[]>(rule?.sentiments ?? ["positive"]);
  const [action, setAction] = useState<AutomationAction>(rule?.action ?? "auto_publish");
  const [tone, setTone] = useState<ReplyTone>(rule?.tone ?? defaultTone);
  const [errors, setErrors] = useState<Errors>({});

  const coversNegative = ruleCoversNegative({ ratings, sentiments });
  // Negative reviews always need a person to approve the reply.
  const effectiveAction: AutomationAction = coversNegative ? "require_approval" : action;

  const toggleRating = (rating: number, checked: boolean) => {
    setRatings((current) => (checked ? RATINGS.filter((r) => r === rating || current.includes(r)) : current.filter((r) => r !== rating)));
    setErrors((e) => ({ ...e, ratings: undefined }));
  };

  const toggleSentiment = (sentiment: ReviewSentiment, checked: boolean) => {
    setSentiments((current) => (checked ? SENTIMENTS.filter((s) => s === sentiment || current.includes(s)) : current.filter((s) => s !== sentiment)));
  };

  const submit = () => {
    const next: Errors = {};
    if (ratings.length === 0) next.ratings = "Select at least one star rating.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const fallbackName = [describeRatings(ratings), sentiments.length ? describeSentiments(sentiments).toLowerCase() : ""].filter(Boolean).join(", ");
    onSubmit({ name: name.trim() || fallbackName, ratings, sentiments, action: effectiveAction, tone, enabled: rule?.enabled ?? true });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{rule ? "Edit Rule" : "Add Rule"}</DialogTitle>
          <DialogDescription>Choose which new reviews this rule replies to and whether replies need approval.</DialogDescription>
        </DialogHeader>

        <form
          id="automation-rule-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField label="Rule name" htmlFor="rule-name" optional error={errors.name} hint="Leave blank to name it after its conditions.">
            <Input id="rule-name" value={name} maxLength={60} placeholder="e.g. 5-star positive reviews" onChange={(e) => setName(e.target.value)} />
          </FormField>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">
              Star Rating<span className="ml-0.5 text-critical" aria-hidden>*</span>
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RATINGS.map((rating) => {
                const id = `rule-rating-${rating}`;
                return (
                  <label key={rating} htmlFor={id} className={optionClass}>
                    <Checkbox id={id} checked={ratings.includes(rating)} onCheckedChange={(c) => toggleRating(rating, c === true)} />
                    <span className="sr-only">{rating}-star</span>
                    <StarRating rating={rating} />
                  </label>
                );
              })}
            </div>
            <FieldMessage error={errors.ratings} />
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">Sentiment</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SENTIMENTS.map((sentiment) => {
                const id = `rule-sentiment-${sentiment}`;
                return (
                  <label key={sentiment} htmlFor={id} className={optionClass}>
                    <Checkbox id={id} checked={sentiments.includes(sentiment)} onCheckedChange={(c) => toggleSentiment(sentiment, c === true)} />
                    {SENTIMENT_LABEL[sentiment]}
                  </label>
                );
              })}
            </div>
            <FieldMessage hint={sentiments.length === 0 ? "No sentiment selected: the rule applies to any sentiment." : undefined} />
          </fieldset>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">Approval</legend>
            <RadioGroup value={effectiveAction} onValueChange={(v) => setAction(v as AutomationAction)} className="mt-2 grid gap-2">
              {(["auto_publish", "require_approval"] as AutomationAction[]).map((value) => {
                const id = `rule-action-${value}`;
                const disabled = value === "auto_publish" && coversNegative;
                return (
                  <label key={value} htmlFor={id} className={`${optionClass} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
                    <RadioGroupItem id={id} value={value} disabled={disabled} />
                    <span>
                      <span className="font-medium">{AUTOMATION_ACTION_LABEL[value]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {value === "auto_publish" ? "AI replies are posted to Google right away." : "AI drafts a reply and waits for someone to approve it."}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
            {coversNegative ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                Rules that include 1–2 star or negative reviews always require approval.
              </p>
            ) : null}
          </fieldset>

          <FormField label="Reply tone" htmlFor="rule-tone">
            <Select value={tone} onValueChange={(v) => setTone(v as ReplyTone)}>
              <SelectTrigger id="rule-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPLY_TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPLY_TONE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="automation-rule-form">
            {rule ? "Save Changes" : "Save Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
