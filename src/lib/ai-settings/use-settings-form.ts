/**
 * The AI settings page's two forms ("How replies sound" and "Images in AI posts"), held by the page
 * so it knows about unsaved changes in either (the "Leave without saving?" guard). Each section saves
 * only its own changed keys with its own save bar; the user's edits sit on top of the settings in
 * force (`settings-form.ts`), so a save, a restricted-mode switch or a refetch never loses typing.
 */
import { useState } from "react";
import { toast } from "sonner";
import type { AiSettings } from "@/api";
import { formatTime } from "@/lib/datetime";
import { settingsErrorText } from "./errors";
import {
  SECTION_KEYS,
  changedKeys,
  editsAfterSave,
  editsWithout,
  settingsErrors,
  settingsPayload,
  type AiSettingsEdits,
  type AiSettingsForm,
  type FormSettingKey,
  type SettingsErrors,
  type SettingsSection,
} from "./settings-form";
import { useUpdateAiSettings } from "./use-ai-settings";

type SectionStatus = { savedAt: string | null; error: string | null; showErrors: boolean };

const IDLE: SectionStatus = { savedAt: null, error: null, showErrors: false };

const SAVED_TOAST: Record<SettingsSection, string> = {
  replies: "Reply settings saved. New AI replies follow them.",
  images: "Image settings saved. New AI post pictures follow them.",
};

export type SettingsSectionState = {
  /** Something would change if saved. */
  dirty: boolean;
  /** Field problems, shown once a save was tried. */
  errors: SettingsErrors;
  hasErrors: boolean;
  saving: boolean;
  /** "3:41 PM" after a save, until the next change. */
  savedAt: string | null;
  /** Why the last save failed. */
  error: string | null;
};

const ALL_KEYS: readonly FormSettingKey[] = [...SECTION_KEYS.replies, ...SECTION_KEYS.images];

const sectionOf = (key: FormSettingKey): SettingsSection => (SECTION_KEYS.replies.includes(key) ? "replies" : "images");

export type AiSettingsFormState = ReturnType<typeof useAiSettingsForm>;

export function useAiSettingsForm(locationId: string, view: AiSettings | undefined) {
  const update = useUpdateAiSettings(locationId);
  const [edits, setEdits] = useState<AiSettingsEdits>({});
  const [status, setStatus] = useState<Record<SettingsSection, SectionStatus>>({ replies: IDLE, images: IDLE });
  const [saving, setSaving] = useState<SettingsSection | null>(null);

  const setSection = (id: SettingsSection, next: Partial<SectionStatus>) =>
    setStatus((current) => ({ ...current, [id]: { ...current[id], ...next } }));

  /** Changes one control (and clears its section's "saved" and error lines). */
  const set = <K extends FormSettingKey>(key: K, value: AiSettingsForm[K]) => {
    setEdits((current) => ({ ...current, [key]: value }));
    setSection(sectionOf(key), { savedAt: null, error: null });
  };

  const section = (id: SettingsSection): SettingsSectionState => {
    const keys = SECTION_KEYS[id];
    const errors = view ? settingsErrors(view, edits, keys) : {};
    const hasErrors = Object.keys(errors).length > 0;
    const { savedAt, error, showErrors } = status[id];
    return {
      dirty: view ? changedKeys(view, edits, keys).length > 0 : false,
      errors: showErrors ? errors : {},
      hasErrors: showErrors && hasErrors,
      saving: saving === id,
      savedAt,
      error,
    };
  };

  const save = async (id: SettingsSection) => {
    if (!view || saving) return;
    const keys = SECTION_KEYS[id];
    if (Object.keys(settingsErrors(view, edits, keys)).length > 0) {
      setSection(id, { showErrors: true, error: null });
      return;
    }
    const body = settingsPayload(view, edits, keys);
    if (Object.keys(body).length === 0) return;
    const sent: AiSettingsEdits = {};
    for (const key of keys) if (key in edits) Object.assign(sent, { [key]: edits[key] });
    setSaving(id);
    setSection(id, { error: null });
    try {
      await update.mutateAsync(body);
      setEdits((current) => editsAfterSave(current, sent));
      setSection(id, { savedAt: formatTime(new Date()), error: null, showErrors: false });
      toast.success(SAVED_TOAST[id]);
    } catch (err) {
      setSection(id, { error: settingsErrorText(err) });
    } finally {
      setSaving(null);
    }
  };

  const discard = (id: SettingsSection) => {
    setEdits((current) => editsWithout(current, SECTION_KEYS[id]));
    setSection(id, IDLE);
  };

  return {
    edits,
    set,
    section,
    save,
    discard,
    /** Unsaved changes in either section. */
    dirty: view ? changedKeys(view, edits, ALL_KEYS).length > 0 : false,
  };
}
