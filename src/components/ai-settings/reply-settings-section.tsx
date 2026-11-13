import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { AiSettings } from "@/api";
import { FormSaveBar } from "@/components/layout/shared/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_SETTING_LIMITS,
  CONTACT_LINE_SOURCE_COPY,
  canUseDefault,
  defaultEdit,
  formValue,
  isChanged,
  willBeDefault,
  type TextSettingKey,
} from "@/lib/ai-settings/settings-form";
import type { AiSettingsFormState } from "@/lib/ai-settings/use-settings-form";
import { CharCount, FieldFoot, ReadOnlyValue, SettingLabel } from "./settings-parts";

/**
 * ① "How replies sound" (`#replies`): the house rules, signature and contact line AI review replies
 * use now. Each shows the value in force, a "Default" tag and "Use default"; one save bar sends only
 * what changed. Client users see the values as text.
 */
export function ReplySettingsSection({
  view,
  form,
  canEdit,
  locationName,
}: {
  view: AiSettings;
  form: AiSettingsFormState;
  canEdit: boolean;
  locationName: string;
}) {
  const state = form.section("replies");
  const limits = view.limits ?? AI_SETTING_LIMITS;

  const field = (key: TextSettingKey) => {
    const isDefault = willBeDefault(view, form.edits, key);
    return {
      value: formValue(view, form.edits, key),
      isDefault,
      pendingDefault: isDefault && isChanged(view, form.edits, key),
      onUseDefault: canUseDefault(view, form.edits, key) ? () => form.set(key, defaultEdit(key) as string) : undefined,
      onChange: (value: string) => form.set(key, value),
      error: state.errors[key],
      canEdit,
    };
  };

  const contact = field("contact_line");
  // Where the contact line in force comes from, until the user changes it.
  const contactSource = isChanged(view, form.edits, "contact_line")
    ? contact.value.trim()
      ? null
      : "Empty uses the default: your Google profile's phone number, else a role."
    : CONTACT_LINE_SOURCE_COPY[view.contact_line_source];

  return (
    // The save bar is a direct child of this column, so it floats at the bottom of the screen while
    // any part of the section is in view.
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-5">
          <TextSetting
            id="ai-house-rules"
            label="House rules"
            multiline
            max={limits.house_rules}
            placeholder="e.g. Never mention prices. Thank people by first name."
            hint="Standing instructions the AI follows in every reply."
            {...field("house_rules")}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <TextSetting
              id="ai-signature"
              label="Signature"
              max={limits.signature}
              placeholder={`e.g. The team at ${shortName(locationName)}`}
              hint={
                <>
                  <p>How replies are signed.</p>
                  {view.settings.restricted ? (
                    <p className="flex items-start gap-1.5 text-foreground">
                      <Info aria-hidden className="mt-px size-3.5 shrink-0 text-info" />
                      <span>In restricted mode a signature that names a person is left off replies; they sign with a role, like “The office team”.</span>
                    </p>
                  ) : null}
                </>
              }
              {...field("signature")}
            />
            <TextSetting
              id="ai-contact-line"
              label="Contact line"
              max={limits.contact_line}
              placeholder="e.g. (506) 555-0142, or our office manager"
              hint={
                <>
                  <p>How an unhappy reviewer can reach you. Replies to 1 and 2-star reviews include it.</p>
                  {contactSource ? <p className="font-medium text-foreground">{contactSource}</p> : null}
                </>
              }
              {...contact}
            />
          </div>
        </div>

        <aside aria-labelledby="ai-replies-uses" className="h-fit rounded-lg border border-border bg-surface-strong p-4 text-sm">
          <h3 id="ai-replies-uses" className="font-semibold text-foreground">
            What an AI reply draws on
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground marker:text-border-strong">
            <li>Your business name, categories and services.</li>
            <li>These settings, and restricted mode below.</li>
            <li>A few of your own past replies, as examples of your voice.</li>
            <li>The review, and the reviewer's first name (none in restricted mode).</li>
          </ul>
          {/* A client user never sends: their agency checks the drafts and presses Send. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {canEdit
              ? "Every draft is checked before you see it, and nothing is sent until you press Send."
              : "Every draft is checked first, and nothing is sent until your agency presses Send."}
          </p>
        </aside>
      </div>

      {canEdit && (state.dirty || state.saving || state.savedAt || state.error || state.hasErrors) ? (
        <FormSaveBar
          dirty={state.dirty}
          saving={state.saving}
          hasErrors={state.hasErrors}
          savedAt={state.savedAt}
          error={state.error}
          onSave={() => void form.save("replies")}
          onDiscard={() => form.discard("replies")}
          savedLabel="Reply settings saved"
        />
      ) : null}
    </div>
  );
}

/** "Harbor Dental" for "Harbor Dental – Downtown Toronto": a placeholder that fits the field. */
function shortName(name: string): string {
  return name.split(/\s+[–—-]\s+/)[0]?.trim() || name;
}

/** One text setting: its label line, the field (or its value, read-only), the hint or error, and the count. */
function TextSetting({
  id,
  label,
  value,
  onChange,
  max,
  multiline = false,
  placeholder,
  hint,
  error,
  isDefault,
  pendingDefault,
  onUseDefault,
  canEdit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  multiline?: boolean;
  placeholder: string;
  hint: ReactNode;
  error?: string | undefined;
  isDefault: boolean;
  pendingDefault: boolean;
  onUseDefault?: (() => void) | undefined;
  canEdit: boolean;
}) {
  const messageId = `${id}-message`;
  const countId = `${id}-count`;
  if (!canEdit) {
    return (
      <div className="min-w-0">
        <SettingLabel id={`${id}-label`} label={label} isDefault={isDefault} />
        <ReadOnlyValue value={value} />
      </div>
    );
  }
  const shared = {
    id,
    value,
    placeholder,
    maxLength: max,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": `${messageId} ${countId}`,
  } as const;
  return (
    <div className="min-w-0">
      <SettingLabel htmlFor={id} label={label} isDefault={isDefault} pendingDefault={pendingDefault} onUseDefault={onUseDefault} />
      <div className="mt-1.5">
        {multiline ? (
          <Textarea {...shared} rows={4} className="min-h-24" onChange={(event) => onChange(event.target.value)} />
        ) : (
          <Input {...shared} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      <FieldFoot id={messageId} error={error} hint={hint} count={<CharCount id={countId} count={value.length} max={max} />} />
    </div>
  );
}
