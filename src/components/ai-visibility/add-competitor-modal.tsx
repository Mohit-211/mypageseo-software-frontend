import { useState } from "react";
import { FormField, RequiredFieldsNote } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AiVisibilityCompetitor, CompetitorInput } from "@/lib/ai-visibility/ai-visibility";

type Errors = Partial<Record<"name" | "website", string>>;

/** Accepts "example.com" or a full URL; returns the bare host, or null if invalid. */
function normaliseWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.includes(".") ? url.hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export function AddCompetitorModal({
  open,
  onOpenChange,
  existing,
  defaultLocation,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: AiVisibilityCompetitor[];
  defaultLocation: string;
  onSubmit: (input: CompetitorInput) => void;
}) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const submit = () => {
    const next: Errors = {};
    const trimmedName = name.trim();
    const host = normaliseWebsite(website);
    if (!trimmedName) next.name = "Enter the competitor's business name.";
    else if (existing.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) next.name = "This competitor is already tracked.";
    if (!website.trim()) next.website = "Enter the competitor's website.";
    else if (!host) next.website = "Enter a valid website, e.g. example.com.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !host) return;
    onSubmit({ name: trimmedName, website: host, location: location.trim() || defaultLocation });
    onOpenChange(false);
  };

  return (
    // The parent remounts this component (via `key`) for each open, so fields start empty.
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Competitor</DialogTitle>
          <DialogDescription>Compare how often this business appears in AI answers for your tracked prompts.</DialogDescription>
        </DialogHeader>
        <form
          id="ai-competitor-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField label="Competitor Name" htmlFor="ai-competitor-name" required error={errors.name}>
            <Input
              id="ai-competitor-name"
              value={name}
              autoComplete="off"
              aria-invalid={errors.name ? true : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((er) => ({ ...er, name: undefined }));
              }}
            />
          </FormField>
          <FormField label="Competitor Website" htmlFor="ai-competitor-website" required error={errors.website}>
            <Input
              id="ai-competitor-website"
              value={website}
              inputMode="url"
              placeholder="example.com"
              aria-invalid={errors.website ? true : undefined}
              onChange={(e) => {
                setWebsite(e.target.value);
                setErrors((er) => ({ ...er, website: undefined }));
              }}
            />
          </FormField>
          <FormField label="Business Location" htmlFor="ai-competitor-location" optional hint={`Defaults to ${defaultLocation}.`}>
            <Input id="ai-competitor-location" value={location} placeholder={defaultLocation} onChange={(e) => setLocation(e.target.value)} />
          </FormField>
          <RequiredFieldsNote />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="ai-competitor-form">
            Add Competitor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
