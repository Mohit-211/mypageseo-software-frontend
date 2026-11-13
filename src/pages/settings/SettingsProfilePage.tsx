import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Contact, LoaderCircle, Mail, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Panel, StatusBadge } from "@/components/layout/shared/data-display";
import { AccountSecurity } from "@/components/settings/account-security";
import { ErrorState, SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import { FormGrid, FormSaveBar, FormTextField } from "@/components/layout/shared/form-fields";
import { getProfile, isApiError, resendVerification, updateProfile, type Profile } from "@/api";
import { formatDate } from "@/lib/datetime";
import { classifyError } from "@/lib/mypageseo/errors";
import {
  PROFILE_NAME_MAX_LENGTH,
  profileFormsAreEqual,
  profileInitials,
  profileToForm,
  toUpdateProfileRequest,
  toUserProfile,
  validateProfile,
  type ProfileFormErrors,
  type ProfileFormValues,
  type ProfileResult,
  type UserProfile,
} from "@/lib/mypageseo/profile";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", member: "Member", client_user: "Client (read-only)" };

function ProfileSettingsPage() {
  // Shares the ["profile"] cache with WorkspaceProvider, so this is usually already loaded.
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => getProfile(signal),
    staleTime: 5 * 60_000,
  });

  const result: ProfileResult = query.isPending
    ? { status: "loading" }
    : query.isError
      ? { status: "error", message: classifyError(query.error).description }
      : { status: "ready", profile: toUserProfile(query.data) };

  if (result.status === "loading") {
    return (
      <div className="space-y-6">
        <SectionSkeleton lines={2} />
        <SectionSkeleton lines={4} />
      </div>
    );
  }
  if (result.status === "error") {
    return <ErrorState title="Your profile couldn't be loaded" description={result.message} onRetry={() => void query.refetch()} />;
  }
  return <ProfileSections profile={result.profile} />;
}

function ProfileSections({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const workspace = useWorkspace();
  const mutation = useMutation({ mutationFn: updateProfile });
  const [saved, setSaved] = useState<UserProfile>(profile);
  const [values, setValues] = useState<ProfileFormValues>(profileToForm(profile));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const organization = workspace.organization;

  const resend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerification(saved.email);
      toast.success("Verification email sent", { description: `Check ${saved.email} for the new link.` });
    } catch (err) {
      toast.error(isApiError(err) && err.reason === "rate_limited" ? "Too many requests. Try again in a few minutes." : "The verification email couldn't be sent. Try again.");
    } finally {
      setResending(false);
    }
  };
  const baseline = profileToForm(saved);
  const dirty = !profileFormsAreEqual(values, baseline);
  const hasErrors = Object.values(errors).some(Boolean);

  const update = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSavedAt(null);
    setSaveError(null);
  };

  const handleSave = () => {
    if (saving) return;
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    setSaving(true);
    setSaveError(null);
    const body = toUpdateProfileRequest(values);
    mutation.mutate(body, {
      onSuccess: (updated) => {
        // Prefer the server's copy; fall back to what was sent if the PATCH returns no profile.
        const next: UserProfile = updated ? toUserProfile(updated) : { ...saved, name: body.name, phone: body.mobile };
        setSaved(next);
        setValues(profileToForm(next));
        queryClient.setQueryData<Profile>(["profile"], (current) => (updated ? { ...current, ...updated } : current ? { ...current, ...body } : current));
        setSavedAt(new Date().toLocaleTimeString());
      },
      // A 400 explains what to change (e.g. the name's length); anything else gets the plain fallback.
      onError: (error) => setSaveError(isApiError(error) && error.status === 400 && error.message ? error.message : "Your profile couldn't be saved. Try again."),
      onSettled: () => setSaving(false),
    });
  };

  const handleDiscard = () => {
    setValues(baseline);
    setErrors({});
    setSavedAt(null);
    setSaveError(null);
  };

  return (
    <div className="space-y-6">
      <section aria-label="Your account" className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-full bg-linear-to-br from-primary to-brand text-xl font-semibold text-primary-foreground ring-4 ring-brand-tint"
          >
            {profileInitials(saved.name, saved.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">{saved.name || saved.email}</p>
            <p className="truncate text-sm text-muted-foreground">{saved.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {organization ? (
                <StatusBadge tone="brand">
                  {ROLE_LABEL[organization.role] ?? "Member"} · {organization.name}
                </StatusBadge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {[saved.createdAt ? `Member since ${formatDate(saved.createdAt)}` : null, saved.lastLoginAt ? `last sign-in ${formatDate(saved.lastLoginAt)}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <Panel title="Your details" description="Your name is shown to your team, for example on the Team screen." icon={Contact} tone="settings">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
          noValidate
        >
          <FormGrid>
            <FormTextField
              id="profile-name"
              label="Full name"
              required
              value={values.name}
              maxLength={PROFILE_NAME_MAX_LENGTH + 20}
              disabled={saving}
              error={errors.name}
              autoComplete="name"
              onChange={(value) => update("name", value)}
            />
            <FormTextField
              id="profile-phone"
              label="Phone number"
              optional
              type="tel"
              autoComplete="tel"
              value={values.phone}
              disabled={saving}
              error={errors.phone}
              hint="Used only to contact you about your account."
              onChange={(value) => update("phone", value)}
            />
          </FormGrid>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Panel>

      <Panel title="Sign-in email" description="The address you sign in with and where account email goes." icon={Mail} tone="settings">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <span className="truncate">{saved.email}</span>
              {saved.emailVerification === "verified" ? (
                <StatusBadge tone="success" icon={BadgeCheck}>
                  Verified
                </StatusBadge>
              ) : saved.emailVerification === "unverified" ? (
                <StatusBadge tone="warning" icon={MailWarning}>
                  Not verified yet
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Verification status unknown</StatusBadge>
              )}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">To change your sign-in email, open a support ticket from Help & support.</p>
          </div>
          {saved.emailVerification === "unverified" ? (
            <Button variant="outline" size="sm" disabled={resending} aria-busy={resending || undefined} onClick={() => void resend()}>
              {resending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Mail aria-hidden />}
              Resend verification email
            </Button>
          ) : null}
        </div>
      </Panel>

      <AccountSecurity />

      {/* The save bar appears once there is something to save (or a result to report). */}
      {dirty || saving || savedAt || saveError || hasErrors ? (
        <FormSaveBar
          dirty={dirty}
          saving={saving}
          hasErrors={hasErrors}
          savedAt={savedAt}
          error={saveError}
          onSave={handleSave}
          onDiscard={handleDiscard}
          savedLabel="Profile saved"
        />
      ) : null}
    </div>
  );
}

export default ProfileSettingsPage;
