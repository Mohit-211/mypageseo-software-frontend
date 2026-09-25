import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, ImageUp, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/mypageseo/app-shell";
import { PageHeader, Panel, SectionHeader, StatusBadge } from "@/components/mypageseo/data-display";
import { SettingsNav } from "@/components/mypageseo/settings-nav";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/mypageseo/states";
import { Button } from "@/components/ui/button";
import {
  FormGrid,
  FormSaveBar,
  FormSelectField,
  FormTextField,
  RequiredFieldsNote,
} from "@/components/mypageseo/form";
import { SUPPORTED_TIMEZONES } from "@/lib/mypageseo/organization-settings";
import {
  JOB_TITLE_MAX_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  getUserProfile,
  profileFormsAreEqual,
  profileInitials,
  profileToForm,
  validateProfile,
  type ProfileCapabilities,
  type ProfileFormErrors,
  type ProfileFormValues,
  type UserProfile,
} from "@/lib/mypageseo/profile";
import { useWorkspace } from "@/lib/mypageseo/workspace";



const DESCRIPTION = "Manage your personal Mypageseo account information and preferences.";

function ProfileSettingsPage() {
  const workspace = useWorkspace();
  const isAgency = workspace.organization?.accountType === "agency";
  const result = getUserProfile();

  return (
    <AppShell>
      <PageHeader title="Profile" description={DESCRIPTION} />
      <SettingsNav active="profile" isAgency={isAgency} />

      {result.status === "loading" ? (
        <TableSkeleton rows={5} columns={2} />
      ) : result.status === "error" ? (
        <ErrorState description={result.message} onRetry={() => window.location.reload()} />
      ) : result.status === "unavailable" ? (
        <EmptyState title="Your profile is unavailable" description={result.reason} />
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
  const navigate = useNavigate();
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
    window.setTimeout(() => {
      setSaved({
        ...saved,
        name: values.name.trim(),
        phone: values.phone.trim() || null,
        jobTitle: values.jobTitle.trim() || null,
        timezone: values.timezone,
      });
      setSaving(false);
      setSavedAt(new Date().toLocaleTimeString());
    }, 500);
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
        <SectionHeader title="Profile details" description="Update your name, contact details and timezone" />
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
                id="profile-job-title"
                label="Job title"
                optional
                value={values.jobTitle}
                maxLength={JOB_TITLE_MAX_LENGTH + 20}
                disabled={readOnly || saving}
                error={errors.jobTitle}
                hint="Shown next to your name on the Team screen."
                onChange={(value) => update("jobTitle", value)}
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

              <FormSelectField
                id="profile-timezone"
                label="Timezone"
                required
                value={values.timezone}
                disabled={readOnly || saving}
                error={errors.timezone}
                hint="Dates and schedules are shown in this timezone."
                options={SUPPORTED_TIMEZONES.map((tz) => ({ value: tz, label: tz.replace(/_/g, " ") }))}
                onChange={(value) => update("timezone", value)}
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

      <section aria-labelledby="profile-security">
        <SectionHeader title="Security" description="Password and additional sign-in protection" />
        <Panel>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden />
                <span>
                  Password change is handled by the authentication service. It isn&rsquo;t connected to this workspace
                  yet, so passwords can&rsquo;t be changed here.
                </span>
              </p>
              <Button variant="outline" size="sm" disabled={!capabilities.canChangePassword}>
                Change password
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden />
                <span>
                  Two-factor authentication isn&rsquo;t available in the current product integration, so no second
                  factor is enforced on this account.
                </span>
              </p>
              <Button variant="outline" size="sm" disabled={!capabilities.canManageTwoFactor}>
                Set up two-factor
              </Button>
            </div>
          </div>
        </Panel>
      </section>

      <section aria-labelledby="profile-session">
        <SectionHeader title="Session" description="End your session on this device" />
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Signing out returns you to the Mypageseo sign-in screen.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!capabilities.canSignOut}
              onClick={() => navigate("/login")}
            >
              <LogOut aria-hidden /> Sign out
            </Button>
          </div>
          {!capabilities.canDeleteAccount ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Account deletion isn&rsquo;t supported from Mypageseo. Ask an organization administrator to remove your
              access from{" "}
              <Link to="/settings/team" className="font-medium text-foreground underline underline-offset-2">
                Team
              </Link>
              .
            </p>
          ) : null}
        </Panel>
      </section>

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
