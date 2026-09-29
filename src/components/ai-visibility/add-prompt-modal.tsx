import { useState } from "react";
import { FieldMessage, FormField } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_PLATFORMS,
  AI_PLATFORM_LABEL,
  FREQUENCY_LABEL,
  TOPICS,
  TOPIC_LABEL,
  type AiPlatform,
  type PromptFrequency,
  type PromptInput,
  type TopicId,
  type TrackedPrompt,
} from "@/lib/ai-visibility/ai-visibility";
import { PlatformIcon } from "./visibility-ui";

const FREQUENCIES: PromptFrequency[] = ["daily", "weekly", "monthly"];
const MAX_PROMPT_LENGTH = 300;

type Errors = Partial<Record<"prompt" | "platforms" | "topic", string>>;

/** Add a prompt, or edit one when `prompt` is given. */
export function AddPromptModal({
  open,
  onOpenChange,
  prompt,
  existingPrompts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: TrackedPrompt | null;
  /** Used to prevent tracking the same question twice. */
  existingPrompts: TrackedPrompt[];
  onSubmit: (input: PromptInput) => void;
}) {
  const editing = Boolean(prompt);
  // Initialised from props; the parent remounts this component (via `key`) for each open.
  const [text, setText] = useState(prompt?.prompt ?? "");
  const [platforms, setPlatforms] = useState<AiPlatform[]>(prompt?.platforms ?? AI_PLATFORMS);
  const [topic, setTopic] = useState<TopicId | "">(prompt?.topic ?? "");
  const [frequency, setFrequency] = useState<PromptFrequency>(prompt?.frequency ?? "weekly");
  const [errors, setErrors] = useState<Errors>({});

  const togglePlatform = (platform: AiPlatform, checked: boolean) => {
    setPlatforms((current) => (checked ? AI_PLATFORMS.filter((p) => p === platform || current.includes(p)) : current.filter((p) => p !== platform)));
    setErrors((e) => ({ ...e, platforms: undefined }));
  };

  const submit = () => {
    const trimmed = text.trim();
    const next: Errors = {};
    if (!trimmed) next.prompt = "Enter the question you want to monitor.";
    else if (trimmed.length < 8) next.prompt = "Enter a complete question (at least 8 characters).";
    else if (existingPrompts.some((p) => p.id !== prompt?.id && p.prompt.trim().toLowerCase() === trimmed.toLowerCase()))
      next.prompt = "This prompt is already being tracked.";
    if (platforms.length === 0) next.platforms = "Select at least one AI platform.";
    if (!topic) next.topic = "Select a category.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !topic) return;
    onSubmit({ prompt: trimmed, platforms, topic, frequency });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Prompt" : "Add Prompt"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changing the question re-runs it on every selected platform."
              : "Track how AI assistants answer a question related to your business."}
          </DialogDescription>
        </DialogHeader>

        <form
          id="ai-prompt-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FormField
            label="Prompt"
            htmlFor="ai-prompt-text"
            required
            error={errors.prompt}
            hint={`Example: “What are the best beauty salons in Delhi?” · ${text.length}/${MAX_PROMPT_LENGTH}`}
          >
            <Textarea
              id="ai-prompt-text"
              value={text}
              maxLength={MAX_PROMPT_LENGTH}
              rows={3}
              placeholder="Enter the question you want to monitor"
              aria-invalid={errors.prompt ? true : undefined}
              aria-describedby="ai-prompt-text-message"
              onChange={(e) => {
                setText(e.target.value);
                setErrors((er) => ({ ...er, prompt: undefined }));
              }}
            />
          </FormField>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">
              Platforms<span className="ml-0.5 text-critical" aria-hidden>*</span>
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {AI_PLATFORMS.map((platform) => {
                const id = `ai-prompt-platform-${platform}`;
                return (
                  <label
                    key={platform}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-brand-tint"
                  >
                    <Checkbox id={id} checked={platforms.includes(platform)} onCheckedChange={(c) => togglePlatform(platform, c === true)} />
                    <PlatformIcon platform={platform} size="sm" />
                    {AI_PLATFORM_LABEL[platform]}
                  </label>
                );
              })}
            </div>
            <FieldMessage error={errors.platforms} />
          </fieldset>

          <FormField label="Category" htmlFor="ai-prompt-category" required error={errors.topic}>
            <Select
              value={topic}
              onValueChange={(v) => {
                setTopic(v as TopicId);
                setErrors((e) => ({ ...e, topic: undefined }));
              }}
            >
              <SelectTrigger id="ai-prompt-category" className="w-full" aria-invalid={errors.topic ? true : undefined}>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {TOPICS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TOPIC_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <fieldset>
            <legend className="text-[13px] font-medium text-foreground">Frequency</legend>
            <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as PromptFrequency)} className="mt-2 grid grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => (
                <label
                  key={f}
                  htmlFor={`ai-prompt-frequency-${f}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-data-[state=checked]:border-primary/40 has-data-[state=checked]:bg-brand-tint"
                >
                  <RadioGroupItem id={`ai-prompt-frequency-${f}`} value={f} />
                  {FREQUENCY_LABEL[f]}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="ai-prompt-form">
            {editing ? "Save Changes" : "Add Prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
