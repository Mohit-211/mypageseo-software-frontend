import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ImageUp } from "lucide-react";
import { AppShell } from "@/components/layout/shared/app-shell";
import { PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/layout/shared/data-display";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AccountSecurity } from "@/components/settings/account-security";
import { ErrorState, TableSkeleton } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";
import {
  FormGrid,
  FormSaveBar,
  FormTextField,
  RequiredFieldsNote,
} from "@/components/layout/shared/form-fields";
import { getProfile, updateProfile, type Profile } from "@/api";
import { classifyError } from "@/lib/mypageseo/errors";
import {
  LIVE_PROFILE_CAPABILITIES,
  PROFILE_NAME_MAX_LENGTH,
  profileFormsAreEqual,
  profileInitials,
  profileToForm,
  toUpdateProfileRequest,
  toUserProfile,
  validateProfile,
  type ProfileCapabilities,
  type ProfileFormErrors,
  type ProfileFormValues,
  type ProfileResult,
  type UserProfile,
} from "@/lib/mypageseo/profile";
import { useWorkspace } from "@/lib/mypageseo/workspace";

const DESCRIPTION = "Manage your personal Mypageseo account information and preferences.";

function ProfileSettingsPage() {
  const workspace = useWorkspace();
  const isAgency = workspace.organization?.accountType === "agency";
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
      : { status: "ready", profile: toUserProfile(query.data), capabilities: LIVE_PROFILE_CAPABILITIES };

  return (
    <AppShell>
      <PageHeader title="Profile" description={DESCRIPTION} />
      <SettingsNav active="profile" isAgency={isAgency} />

      {result.status === "loading" ? (
        <TableSkeleton rows={5} columns={2} />
      ) : result.status === "error" ? (
        <ErrorState description={result.message} onRetry={() => void query.refetch()} />
      ) : (
        <ProfileSections profile={result.profile} capabilities={result.capabilities} />
      )}
    </AppShell>
  );
}

function ProfileSections({
  profile,
  capabilities,
}: {
  profile: UserProfile;
  capabilities: ProfileCapabilities;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: updateProfile });
  const [saved, setSaved] = useState<UserProfile>(profile);
  const [values, setValues] = useState<ProfileFormValues>(profileToForm(profile));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const readOnly = !capabilities.canEditProfile;
  const baseline = profileToForm(saved);
  const dirty = !profileFormsAreEqual(values, baseline);
  const hasErrors = Object.keys(errors).length > 0;

  const update = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSavedAt(null);
    setSaveError(null);
  };

  const handleSave = () => {
    if (saving || readOnly) return;
    const nextErrors = validateProfile(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!capabilities.canSaveProfile) {
      setSaveError("Saving your profile requires the account service, which isn't connected yet.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const body = toUpdateProfileRequest(values);
    mutation.mutate(body, {
      onSuccess: (updated) => {
        // Prefer the server's copy; fall back to what was sent if the PATCH returns no profile.
        const next: UserProfile = updated
          ? toUserProfile(updated)
          : { ...saved, name: body.name, phone: body.mobile };
        setSaved(next);
        setValues(profileToForm(next));
        queryClient.setQueryData<Profile>(["profile"], (current) =>
          updated ? { ...current, ...updated } : current ? { ...current, ...body } : current,
        );
        setSavedAt(new Date().toLocaleTimeString());
      },
      onError: (error) => {
        setSaveError(error instanceof Error && error.message ? error.message : "Your profile could not be saved.");
      },
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
      {readOnly ? (
        <Panel className="border-l-4 border-l-brand-soft">
          <p className="text-sm text-muted-foreground">
            Your profile is read-only for this account. Contact an organization administrator to make changes.
          </p>
        </Panel>
      ) : null}

      <section aria-labelledby="profile-identity">
        <SectionHeader title="Your account" description="Personal details shown to your team across Mypageseo" />
        <Panel>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex items-center gap-4">
              {saved.avatarUrl ? (
                <img
                  src={saved.avatarUrl}
                  alt={`${saved.name} profile image`}
                  className="size-16 rounded-full border border-border object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-16 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
                >
                  {profileInitials(saved.name, saved.email)}
                </span>
              )}
              <div>
                <Button variant="outline" size="sm" disabled={!capabilities.canUploadAvatar}>
                  <ImageUp aria-hidden /> Upload image
                </Button>
                {!capabilities.canUploadAvatar ? (
                  <p className="mt-1.5 max-w-56 text-xs text-muted-foreground">
                    Image upload needs file storage, which isn&rsquo;t connected yet. Your initials are used meanwhile.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex-1 space-y-1 sm:pl-2">
              <p className="text-sm font-semibold text-foreground">{saved.name}</p>
              <p className="text-sm text-muted-foreground">{saved.email}</p>
              {saved.jobTitle ? <p className="text-xs text-muted-foreground">{saved.jobTitle}</p> : null}
            </div>
          </div>
        </Panel>
      </section>

      <section aria-labelledby="profile-details">
        <SectionHeader title="Profile details" description="Update your name and phone number" />
        <Panel>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
            noValidate
          >
            <RequiredFieldsNote />
            <FormGrid>
              <FormTextField
                id="profile-name"
                label="Full name"
                required
                value={values.name}
                maxLength={PROFILE_NAME_MAX_LENGTH + 20}
                disabled={readOnly || saving}
                error={errors.name}
                hint="Shown to your team on the Team screen."
                onChange={(value) => update("name", value)}
              />

              <FormTextField
                id="profile-phone"
                label="Phone number"
                optional
                type="tel"
                value={values.phone}
                disabled={readOnly || saving}
                error={errors.phone}
                hint="Used for account contact only."
                onChange={(value) => update("phone", value)}
              />

            </FormGrid>

            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Panel>
      </section>

      <section aria-labelledby="profile-email">
        <SectionHeader title="Email address" description="The address used to sign in and receive account email" />
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                <span className="truncate">{saved.email}</span>
                {saved.emailVerification === "verified" ? (
                  <StatusBadge tone="success">
                    <BadgeCheck className="mr-1 inline size-3.5" aria-hidden />
                    Verified
                  </StatusBadge>
                ) : saved.emailVerification === "unverified" ? (
                  <StatusBadge tone="warning">Unverified</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">Verification status unknown</StatusBadge>
                )}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Changing your sign-in email is handled by the authentication service, which isn&rsquo;t connected yet.
              </p>
            </div>
            {saved.emailVerification === "unverified" ? (
              <Button variant="outline" size="sm" disabled={!capabilities.canResendEmailVerification}>
                Resend verification email
              </Button>
            ) : null}
          </div>
        </Panel>
      </section>

      <AccountSecurity />

      <FormSaveBar
        dirty={dirty}
        saving={saving}
        hasErrors={hasErrors}
        savedAt={savedAt}
        error={saveError}
        disabled={readOnly}
        onSave={handleSave}
        onDiscard={handleDiscard}
        savedLabel="Profile saved"
      />
    </div>
  );
}

export default ProfileSettingsPage;
