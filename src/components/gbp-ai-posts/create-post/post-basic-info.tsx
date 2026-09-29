import type { ComponentType } from "react";
import { CalendarDays, Megaphone, ShoppingBag, Tag } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { FormField, FormTextField } from "@/components/layout/shared/form-fields";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AI_POST_CTA_LABEL, AI_POST_TYPE_LABEL, type AiPostCta, type AiPostType } from "@/lib/gbp/ai-posts";
import type { LocationSummary } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";
import type { FormSectionProps } from "./form-model";

const POST_TYPES: { value: AiPostType; description: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "whats_new", description: "Updates & news", icon: Megaphone },
  { value: "offer", description: "Deals & promos", icon: Tag },
  { value: "event", description: "Dated happenings", icon: CalendarDays },
  { value: "product", description: "Showcase an item", icon: ShoppingBag },
];

const CTAS: AiPostCta[] = ["book", "order_online", "learn_more", "call_now", "sign_up", "none"];

export function PostBasicInfo({ form, onChange, errors, locations }: FormSectionProps & { locations: LocationSummary[] }) {
  return (
    <Panel title="Post details" description="Choose the profile, topic and type of post.">
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Business profile" htmlFor="post-profile" required error={errors.locationId}>
            <Select value={form.locationId} onValueChange={(locationId) => onChange({ locationId })}>
              <SelectTrigger id="post-profile" className="w-full" aria-invalid={errors.locationId ? true : undefined}>
                <SelectValue placeholder="Select GBP profile" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.businessName}
                    <span className="text-muted-foreground"> · {location.area}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormTextField
            id="post-topic"
            label="Post topic"
            required
            value={form.topic}
            onChange={(topic) => onChange({ topic })}
            placeholder="e.g. Summer skincare tips"
            error={errors.topic}
            hint="AI uses this to write the post and create the image."
            maxLength={120}
          />
        </div>

        <fieldset>
          <legend className="text-[13px] font-medium text-foreground">Post type</legend>
          <div role="radiogroup" aria-label="Post type" className="mt-1.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {POST_TYPES.map(({ value, description, icon: Icon }) => {
              const selected = form.type === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ type: value })}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    selected
                      ? "border-primary bg-brand-tint ring-1 ring-primary"
                      : "border-border bg-surface hover:border-primary/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-md",
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{AI_POST_TYPE_LABEL[value]}</span>
                    <span className="block truncate text-xs text-muted-foreground">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormField label="Call to action button" htmlFor="post-cta" hint="Shown as a button under your post on Google.">
          <Select value={form.cta} onValueChange={(cta) => onChange({ cta: cta as AiPostCta })}>
            <SelectTrigger id="post-cta" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CTAS.map((cta) => (
                <SelectItem key={cta} value={cta}>{AI_POST_CTA_LABEL[cta]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
    </Panel>
  );
}
