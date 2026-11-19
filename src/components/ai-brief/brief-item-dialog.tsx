import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { BriefSection } from "@/api";
import { CharCount, FieldFoot } from "@/components/ai-settings/settings-parts";
import { FormAlert } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BRIEF_REQUIRED_FIELDS,
  BRIEF_SECTION_COPY,
  BRIEF_SECTION_FIELDS,
  briefChangeErrorText,
  briefFieldCopy,
  briefFormErrors,
  briefItemChange,
  briefItemForm,
  type BriefFieldKey,
  type BriefItem,
  type BriefItemForm,
} from "@/lib/ai-brief/brief";
import { useBriefMutations } from "@/lib/ai-brief/use-brief";

/**
 * Adds an item to a section of the business brief, or corrects one (`PATCH …/ai/brief`). The owner's words are kept
 * through every rebuild (the item is then locked). The backend's field problem (400 `invalid_change` with `field`,
 * e.g. a page off the business's website) shows next to its field; the rest above the buttons.
 */
export function BriefItemDialog({ locationId, section, item, onClose }: { locationId: string; section: BriefSection; item: BriefItem | null; onClose: () => void }) {
  const { patch } = useBriefMutations(locationId);
  const [form, setForm] = useState<BriefItemForm>(() => briefItemForm(item));
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<{ field: BriefFieldKey; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = BRIEF_SECTION_COPY[section];
  const fields = BRIEF_SECTION_FIELDS[section];
  const errors = briefFormErrors(section, form);
  const saving = patch.isPending;

  const set = (key: BriefFieldKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (serverError?.field === key) setServerError(null);
    setError(null);
  };

  const submit = () => {
    if (saving) return;
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    const change = briefItemChange(section, item, form);
    if (!change) {
      onClose();
      return;
    }
    patch.mutate(
      { items: [change] },
      {
        onSuccess: () => {
          toast.success(item ? "Saved. The AI uses your words, and rebuilds keep them." : `Added. The AI uses it, and rebuilds keep it.`);
          onClose();
        },
        onError: (err) => {
          const result = briefChangeErrorText(err);
          if (result.field && (fields as readonly string[]).includes(result.field)) setServerError({ field: result.field as BriefFieldKey, text: result.text });
          else setError(result.text);
        },
      },
    );
  };

  const title = item ? `Edit ${copy.noun}` : copy.add;
  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {item ? "Your words replace the AI's, and every rebuild keeps them." : "Your own addition: every rebuild keeps it."} {copy.description}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {fields.map((key) => {
            const field = briefFieldCopy(section, key);
            const id = `brief-${section}-${key}`;
            const messageId = `${id}-message`;
            const fieldError = serverError?.field === key ? serverError.text : showErrors ? errors[key] : undefined;
            const required = BRIEF_REQUIRED_FIELDS[section].includes(key);
            const value = form[key];
            const shared = {
              id,
              value,
              placeholder: field.placeholder,
              disabled: saving,
              "aria-invalid": fieldError ? true : undefined,
              "aria-describedby": messageId,
              onChange: (event: { target: { value: string } }) => set(key, event.target.value),
            } as const;
            return (
              <div key={key} className="min-w-0">
                <Label htmlFor={id}>
                  {field.label}
                  {required ? <span className="text-muted-foreground"> (required)</span> : null}
                </Label>
                <div className="mt-1.5">
                  {field.list ? (
                    <Textarea {...shared} rows={4} className="min-h-24" />
                  ) : field.multiline ? (
                    <Textarea {...shared} rows={3} maxLength={field.max} className="min-h-20" />
                  ) : (
                    <Input {...shared} maxLength={field.max} inputMode={key === "page_url" ? "url" : undefined} />
                  )}
                </div>
                <FieldFoot
                  id={messageId}
                  error={fieldError}
                  hint={field.hint}
                  count={field.list ? undefined : <CharCount count={value.length} max={field.max} />}
                />
              </div>
            );
          })}
          {error ? <FormAlert>{error}</FormAlert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {item ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
