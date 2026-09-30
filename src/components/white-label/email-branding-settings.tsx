import { useState } from "react";
import { format } from "date-fns";
import { Eye, Save } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { SectionSkeleton } from "@/components/layout/shared/feedback/states";
import { FormGrid, FormTextareaField, FormTextField, SubmitButton, useSubmitGuard } from "@/components/layout/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  LOGO_RULES,
  isValidEmail,
  reportTheme,
  whiteLabelActions,
  type AgencyBranding,
  type EmailBranding,
} from "@/lib/white-label/white-label";
import { ImageUploader } from "./branding/image-uploader";
import { brandedButton, themeStyle } from "./white-label-theme";
import { AgencyMark } from "./white-label-ui";

type Errors = Partial<Record<"senderName" | "senderEmail", string>>;

/** The report-ready email a client receives, in agency branding. */
function EmailPreview({ email, branding, clientName }: { email: EmailBranding; branding: AgencyBranding | null; clientName: string }) {
  const theme = { ...reportTheme(branding), ...(email.logoUrl ? { logoUrl: email.logoUrl } : {}) };
  const month = format(new Date(), "MMMM yyyy");
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="space-y-1 border-b border-border bg-muted/50 px-4 py-3 text-xs">
        <p className="truncate">
          <span className="text-muted-foreground">From: </span>
          <span className="font-medium text-foreground">{email.senderName || theme.agencyName}</span>{" "}
          <span className="text-muted-foreground">&lt;{email.senderEmail || "reports@youragency.com"}&gt;</span>
        </p>
        <p className="truncate">
          <span className="text-muted-foreground">Subject: </span>
          <span className="font-medium text-foreground">
            Your {month} marketing report for {clientName}
          </span>
        </p>
      </div>
      <div style={themeStyle(theme)} className="bg-slate-100 p-4 text-slate-900 sm:p-6">
        <div className="mx-auto max-w-md overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="border-b-4 border-(--wl-primary) px-6 py-4">
            <AgencyMark theme={theme} showName />
          </div>
          <div className="space-y-4 px-6 py-6">
            <h3 className="text-lg font-semibold text-slate-900">Hi {clientName} team,</h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Your {month} marketing report is ready. It covers your Google Business Profile, reviews and AI visibility for the month.
            </p>
            <span className={brandedButton.primary}>View Report</span>
            <p className="text-sm text-slate-600">
              Thanks,
              <br />
              <span className="font-medium text-slate-900">{email.senderName || theme.agencyName}</span>
            </p>
          </div>
          <div className="bg-(--wl-secondary) px-6 py-4 text-xs text-(--wl-secondary-fg)">
            <p>{email.footer || "Your monthly marketing report is ready."}</p>
            {theme.website ? <p className="mt-1 font-medium text-(--wl-accent)">{theme.website.replace(/^https?:\/\//, "")}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Client Communication: sender identity and branding for report emails. */
export function EmailBrandingSettings({ settings, branding, sampleClientName }: { settings: EmailBranding; branding: AgencyBranding | null; sampleClientName: string }) {
  const [draft, setDraft] = useState(settings);
  const [errors, setErrors] = useState<Errors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const { pending, run } = useSubmitGuard();

  const update = <K extends keyof EmailBranding>(key: K, value: EmailBranding[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = () => {
    const next: Errors = {};
    if (!draft.senderName.trim()) next.senderName = "Enter a sender name.";
    if (!isValidEmail(draft.senderEmail)) next.senderEmail = "Enter a valid email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    void run(async () => {
      await whiteLabelActions.updateEmailBranding({ ...draft, senderName: draft.senderName.trim(), senderEmail: draft.senderEmail.trim(), footer: draft.footer.trim() });
      toast.success("Email branding saved.");
    });
  };

  return (
    <Panel
      title="Client Communication"
      description="How report emails to your clients look and who they come from."
      actions={
        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye aria-hidden /> Preview Email
        </Button>
      }
    >
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <FormGrid>
          <FormTextField
            id="sender-name"
            label="Sender Name"
            required
            value={draft.senderName}
            placeholder="ABC Digital Marketing"
            error={errors.senderName}
            onChange={(value) => update("senderName", value)}
          />
          <FormTextField
            id="sender-email"
            label="Sender Email"
            required
            type="email"
            value={draft.senderEmail}
            placeholder="reports@abcmarketing.com"
            error={errors.senderEmail}
            hint="Sending from your domain requires email verification once email delivery is connected."
            onChange={(value) => update("senderEmail", value)}
          />
        </FormGrid>

        <ImageUploader
          label="Email Logo"
          prompt="Upload an email logo"
          rules={LOGO_RULES}
          value={draft.logoUrl}
          fileName={draft.logoFileName}
          upload={whiteLabelActions.uploadLogo}
          hint={draft.logoUrl ? undefined : "Optional. Your agency logo is used when no email logo is uploaded."}
          onChange={(image) => setDraft((d) => ({ ...d, logoUrl: image?.url ?? null, logoFileName: image?.fileName ?? null }))}
        />

        <FormTextareaField
          id="email-footer"
          label="Email Footer"
          optional
          rows={3}
          value={draft.footer}
          placeholder="Your monthly marketing report is ready."
          onChange={(value) => update("footer", value)}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            <Eye aria-hidden /> Preview Email
          </Button>
          <SubmitButton pending={pending} icon={<Save aria-hidden />}>
            Save Changes
          </SubmitButton>
        </div>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>The report-ready email your client receives. Unsaved changes are included.</DialogDescription>
          </DialogHeader>
          <EmailPreview email={draft} branding={branding} clientName={sampleClientName} />
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

export function EmailBrandingSkeleton() {
  return <SectionSkeleton lines={6} />;
}
