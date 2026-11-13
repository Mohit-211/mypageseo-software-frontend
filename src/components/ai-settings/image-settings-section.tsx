import type { ReactNode } from "react";
import type { AiLogoPlacement, AiSettings } from "@/api";
import { FormSaveBar } from "@/components/layout/shared/form-fields";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  AI_SETTING_LIMITS,
  LOGO_PLACEMENT_COPY,
  canUseDefault,
  defaultEdit,
  isChanged,
  shownImageValue,
  willBeDefault,
  type ImageSettingKey,
} from "@/lib/ai-settings/settings-form";
import type { AiSettingsFormState } from "@/lib/ai-settings/use-settings-form";
import { FieldFoot, ReadOnlyValue, SettingLabel } from "./settings-parts";

const LOGO_OPTIONS = (["ai_images", "all_images", "off"] as const).map((value) => ({ value, label: LOGO_PLACEMENT_COPY[value].label }));

/**
 * ④ "Images in AI posts" (`#images`): where the logo goes, AI images, AI photo enhancement and how
 * long before a library photo is used again. Saved now; AI posts use them in a coming update. Its own
 * save bar sends only what changed.
 */
export function ImageSettingsSection({ view, form, canEdit }: { view: AiSettings; form: AiSettingsFormState; canEdit: boolean }) {
  const state = form.section("images");
  const reuse = (view.limits ?? AI_SETTING_LIMITS).photo_reuse_days;

  const meta = (key: ImageSettingKey) => {
    const isDefault = willBeDefault(view, form.edits, key);
    return {
      isDefault,
      pendingDefault: isDefault && isChanged(view, form.edits, key),
      onUseDefault: canEdit && canUseDefault(view, form.edits, key) ? () => form.set(key, defaultEdit(key) as null) : undefined,
    };
  };

  const logo = shownImageValue(view, form.edits, "logo_on");
  const days = shownImageValue(view, form.edits, "photo_reuse_days");

  return (
    <div className="space-y-5">
      <div className="divide-y divide-border rounded-lg border border-border">
        <SettingRow>
          <SettingLabel id="ai-logo-label" label="Your logo on post images" {...meta("logo_on")} />
          <div className="mt-2">
            {canEdit ? (
              <SegmentedControl<AiLogoPlacement>
                aria-label="Your logo on post images"
                value={logo}
                onValueChange={(value) => form.set("logo_on", value)}
                options={LOGO_OPTIONS}
              />
            ) : (
              <ReadOnlyValue value={LOGO_PLACEMENT_COPY[logo].label} className="sm:max-w-xs" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{LOGO_PLACEMENT_COPY[logo].hint}</p>
        </SettingRow>

        <SwitchSetting
          id="ai-images"
          label="AI images"
          description="The AI may make images for your posts."
          checked={shownImageValue(view, form.edits, "ai_images")}
          onChange={(value) => form.set("ai_images", value)}
          canEdit={canEdit}
          {...meta("ai_images")}
        />
        <SwitchSetting
          id="ai-enhance"
          label="Enhance photos with AI"
          description="Your own photos may be enhanced with AI before they're posted."
          checked={shownImageValue(view, form.edits, "ai_enhance")}
          onChange={(value) => form.set("ai_enhance", value)}
          canEdit={canEdit}
          {...meta("ai_enhance")}
        />

        <SettingRow>
          <SettingLabel {...(canEdit ? { htmlFor: "ai-photo-reuse" } : { id: "ai-photo-reuse-label" })} label="Days before a photo is used again" {...meta("photo_reuse_days")} />
          {canEdit ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="ai-photo-reuse"
                  type="number"
                  inputMode="numeric"
                  min={reuse.min}
                  max={reuse.max}
                  step={1}
                  className="w-28"
                  value={days}
                  aria-invalid={state.errors.photo_reuse_days ? true : undefined}
                  aria-describedby="ai-photo-reuse-message"
                  onChange={(event) => form.set("photo_reuse_days", event.target.value)}
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <FieldFoot
                id="ai-photo-reuse-message"
                error={state.errors.photo_reuse_days}
                hint={`A photo from your library waits this long before it's used in another post (${reuse.min} to ${reuse.max} days).`}
              />
            </>
          ) : (
            <ReadOnlyValue value={`${days} days`} className="sm:max-w-xs" />
          )}
        </SettingRow>
      </div>

      {canEdit && (state.dirty || state.saving || state.savedAt || state.error || state.hasErrors) ? (
        <FormSaveBar
          dirty={state.dirty}
          saving={state.saving}
          hasErrors={state.hasErrors}
          savedAt={state.savedAt}
          error={state.error}
          onSave={() => void form.save("images")}
          onDiscard={() => form.discard("images")}
          savedLabel="Image settings saved"
        />
      ) : null}
    </div>
  );
}

function SettingRow({ children }: { children: ReactNode }) {
  return <div className="min-w-0 px-3.5 py-3">{children}</div>;
}

/** A yes/no setting: its name, "Default" tag and description on the left, the switch on the right. */
function SwitchSetting({
  id,
  label,
  description,
  checked,
  onChange,
  canEdit,
  isDefault,
  pendingDefault,
  onUseDefault,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  canEdit: boolean;
  isDefault: boolean;
  pendingDefault: boolean;
  onUseDefault?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <SettingLabel htmlFor={id} label={label} isDefault={isDefault} pendingDefault={pendingDefault} onUseDefault={onUseDefault} />
        <p id={`${id}-help`} className="mt-0.5 text-xs text-muted-foreground">
          {description} <span className="font-medium text-foreground">{checked ? "On" : "Off"}.</span>
        </p>
      </div>
      <Switch id={id} checked={checked} disabled={!canEdit} aria-describedby={`${id}-help`} onCheckedChange={onChange} className="mt-1.5" />
    </div>
  );
}
