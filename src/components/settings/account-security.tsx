import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Loader2, LogOut, Trash2 } from "lucide-react";
import { changePassword, deactivateAccount, isApiError, logout } from "@/api";
import { Panel, SectionHeader } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERIC_AUTH_ERROR, passwordSchema } from "@/lib/auth/auth-recovery";

/** Password change, sign out and account deletion (`/auth` session endpoints). */
export function AccountSecurity() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      queryClient.clear();
      void navigate("/login", { replace: true });
    }
  };

  return (
    <>
      <section aria-labelledby="profile-security">
        <SectionHeader title="Security" description="Password and sign-in" />
        <Panel>
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden />
                <span>Changing your password signs you out on every other device.</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
                Change password
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <LogOut className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden />
                <span>Sign out of Mypageseo on this device.</span>
              </p>
              <Button variant="outline" size="sm" disabled={signingOut} onClick={() => void signOut()}>
                {signingOut ? <Loader2 aria-hidden className="animate-spin" /> : <LogOut aria-hidden />} Sign out
              </Button>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Trash2 className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
                <span>Delete your account. Your connected Google accounts are disconnected and your memberships end.</span>
              </p>
              <Button variant="outline" size="sm" className="text-critical" onClick={() => setDeleting(true)}>
                Delete account
              </Button>
            </div>
          </div>
        </Panel>
      </section>

      {changing ? <ChangePasswordDialog onClose={() => setChanging(false)} /> : null}
      {deleting ? (
        <DeleteAccountDialog
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            queryClient.clear();
            void navigate("/login", { replace: true });
          }}
        />
      ) : null}
    </>
  );
}

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const rule = passwordSchema.safeParse(next);
    const nextErrors: typeof errors = {};
    if (!current) nextErrors.current = "Enter your current password.";
    if (!rule.success) nextErrors.next = rule.error.issues[0]?.message ?? "Choose a stronger password.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      await changePassword(current, next);
      toast.success("Password changed. Other devices have been signed out.");
      onClose();
    } catch (error) {
      const reason = isApiError(error) ? error.reason : undefined;
      if (reason === "wrong_password") setErrors({ current: "That isn't your current password." });
      else if (reason === "same_password") setErrors({ next: "Choose a password different from the current one." });
      else if (isApiError(error) && error.status === 400 && error.message) setErrors({ next: error.message });
      else setFormError(GENERIC_AUTH_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>At least 8 characters, including a letter and a number.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" value={current} aria-invalid={Boolean(errors.current)} onChange={(e) => setCurrent(e.target.value)} />
            {errors.current ? <p className="text-xs font-medium text-critical">{errors.current}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" value={next} aria-invalid={Boolean(errors.next)} onChange={(e) => setNext(e.target.value)} />
            {errors.next ? <p className="text-xs font-medium text-critical">{errors.next}</p> : null}
          </div>
          {formError ? <p role="alert" className="text-sm text-critical">{formError}</p> : null}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null} Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!password) {
      setError("Enter your password to confirm.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deactivateAccount(password);
      toast.success("Your account was deleted.");
      onDeleted();
    } catch (err) {
      setError(isApiError(err) && err.reason === "wrong_password" ? "That password isn't right." : GENERIC_AUTH_ERROR);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || deleting ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This can't be undone. Every connected Google account is disconnected, your organization memberships end and
            every session is signed out.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Your password</Label>
            <Input id="delete-password" type="password" autoComplete="current-password" value={password} aria-invalid={Boolean(error)} onChange={(e) => setPassword(e.target.value)} />
            {error ? <p role="alert" className="text-xs font-medium text-critical">{error}</p> : null}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={deleting}>
              {deleting ? <Loader2 aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />} Delete account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
