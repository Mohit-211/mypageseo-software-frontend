import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, Images } from "lucide-react";
import type { AiImageStyleSetting, AiLogoPlacement, AiSettings } from "@/api";
import { FormSaveBar } from "@/components/layout/shared/form-fields";
import { IconChip } from "@/components/layout/shared/icon-chip";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  AI_SETTING_LIMITS,
  DESIGNED_IMAGE_NOTE,
  IMAGE_STYLES,
  IMAGE_STYLE_COPY,
  LOGO_PLACEMENTS,
  LOGO_PLACEMENT_COPY,
  canUseDefault,
  defaultEdit,
  hasImageStyle,
  isChanged,
  shownImageValue,
  willBeDefault,
  type ImageSettingKey,
} from "@/lib/ai-settings/settings-form";
import type { AiSettingsFormState } from "@/lib/ai-settings/use-settings-form";
import { cn } from "@/lib/utils";
import { FieldFoot, ReadOnlyValue, SettingLabel } from "./settings-parts";

const LOGO_OPTIONS = LOGO_PLACEMENTS.map((value) => ({ value, label: LOGO_PLACEMENT_COPY[value].label }));

/**
 * "Images in AI posts" (`#images`): where the logo goes on post pictures (`all_images` by default since
 * Phase 25c), how a picture is finished (`image_style`: a photo with the logo, or a designed graphic, with
 * Google's guidance next to the latter), AI images, AI photo enhancement and how long before a library
 * photo is used again; plus the way to the photo library. AI posts use them now. Its own save bar sends
 * only what changed.
 */
export function ImageSettingsSection({
  view,
  form,
  canEdit,
  libraryLink,
}: {
  view: AiSettings;
  form: AiSettingsFormState;
  canEdit: boolean;
  /** The photo library page. */
  libraryLink: string;
}) {
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
  const style = shownImageValue(view, form.edits, "image_style");
  const days = shownImageValue(view, form.edits, "photo_reuse_days");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-strong px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <IconChip icon={Images} tone="ai" size="sm" className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Your photo library</p>
            <p className="text-xs text-muted-foreground">AI posts use a fitting photo of yours first, then that photo touched up, and only then an AI image.</p>
          </div>
        </div>
        <Link
          to={libraryLink}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-md text-sm font-semibold text-primary underline-offset-4 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
        >
          {canEdit ? "Manage photos" : "See photos"} <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        <SettingRow>
          <SettingLabel id="ai-logo-label" label="Your logo on post pictures" {...meta("logo_on")} />
          <div className="mt-2">
            {canEdit ? (
              <SegmentedControl<AiLogoPlacement>
                aria-label="Your logo on post pictures"
                value={logo}
                onValueChange={(value) => form.set("logo_on", value)}
                options={LOGO_OPTIONS}
              />
            ) : (
              <ReadOnlyValue value={LOGO_PLACEMENT_COPY[logo].label} className="sm:max-w-xs" />
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {LOGO_PLACEMENT_COPY[logo].hint} {logo === "off" ? null : "It's left off a picture where it wouldn't be easy to read."}
          </p>
        </SettingRow>

        {hasImageStyle(view) ? (
          <SettingRow>
            <SettingLabel id="ai-image-style-label" label="How pictures are finished" {...meta("image_style")} />
            {canEdit ? (
              <RadioGroup
                aria-labelledby="ai-image-style-label"
                value={style}
                onValueChange={(value) => form.set("image_style", value as AiImageStyleSetting)}
                className="mt-2 grid gap-2 md:grid-cols-2"
              >
                {IMAGE_STYLES.map((option) => (
                  <ImageStyleOption key={option} value={option} selected={style === option} />
                ))}
              </RadioGroup>
            ) : (
              <>
                <ReadOnlyValue value={IMAGE_STYLE_COPY[style].label} className="sm:max-w-xs" />
                <p className="mt-1.5 text-xs text-muted-foreground">{IMAGE_STYLE_COPY[style].hint}</p>
              </>
            )}
            {style === "designed" ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground">
                <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0 text-warning" />
                <span>{DESIGNED_IMAGE_NOTE}</span>
              </p>
            ) : null}
          </SettingRow>
        ) : null}

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

/** One image style as a choice card; the designed graphic carries Google's note in its own words. */
function ImageStyleOption({ value, selected }: { value: AiImageStyleSetting; selected: boolean }) {
  const id = `ai-image-style-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        selected ? "border-primary bg-brand-tint/60" : "border-border-strong bg-card hover:bg-accent/60",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {IMAGE_STYLE_COPY[value].label}
          {value === "photo_logo" ? <span className="font-normal text-muted-foreground"> · Recommended</span> : null}
        </span>
        <span className="block text-xs text-muted-foreground">{IMAGE_STYLE_COPY[value].hint}</span>
        {value === "designed" ? <span className="mt-1 block text-xs text-muted-foreground">Google may reject some: its guidelines ask for pictures without added text.</span> : null}
      </span>
    </label>
  );
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
