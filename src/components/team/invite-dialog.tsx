import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, LoaderCircle, Send, UserRound } from "lucide-react";
import { inviteMember } from "@/api";
import { FormAlert, FormTextField } from "@/components/layout/shared/form-fields";
import { TEAM_KEY, inviteErrorText } from "@/lib/team/team";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ClientChecklist, MemberClientScope } from "./client-access";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { cn } from "@/lib/utils";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ROLE_OPTIONS = [
  {
    value: "member",
    icon: UserRound,
    title: "Team member",
    description: "Works on locations, reports and posts. Can't change settings, the team or billing.",
  },
  {
    value: "client_user",
    icon: Eye,
    title: "Client (read-only)",
    description: "Sees only their own locations, reports and dashboard, and can approve posts when you ask.",
  },
] as const;

/** Invite a member, or (agency) a read-only client user for chosen clients. The link is valid 7 days. */
export function InviteDialog({ onClose, clientId }: { onClose: () => void; clientId?: string }) {
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const agency = workspace.organization?.accountType === "agency";
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [role, setRole] = useState<"member" | "client_user">(clientId ? "client_user" : "member");
  const [clientIds, setClientIds] = useState<string[]>(clientId ? [clientId] : []);
  const [limited, setLimited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsClients = role === "client_user" || (agency && limited);
  const clientName = clientId ? workspace.clients.find((client) => client.id === clientId)?.name : undefined;

  const send = async () => {
    if (saving) return;
    if (!EMAIL.test(email.trim())) {
      setEmailError("Enter a valid email address, like name@company.com.");
      return;
    }
    if (needsClients && clientIds.length === 0) {
      setError("Pick at least one client.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const invitation = await inviteMember({ email: email.trim(), role, ...(needsClients ? { client_ids: clientIds } : {}) });
      void queryClient.invalidateQueries({ queryKey: TEAM_KEY });
      if (invitation.email_sent === false) {
        toast.warning("Invitation created, but the email wasn't sent", { description: "Ask them to watch for it, or contact support if it doesn't arrive." });
      } else {
        toast.success(`Invitation sent to ${invitation.email}`, { description: "The link in the email works for 7 days." });
      }
      onClose();
    } catch (err) {
      setError(inviteErrorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (open || saving ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clientName ? `Invite someone from ${clientName}` : "Invite someone"}</DialogTitle>
          <DialogDescription>They get an email with a sign-up link that works for 7 days.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <FormTextField
            id="invite-email"
            label="Email"
            type="email"
            required
            autoComplete="off"
            autoFocus
            value={email}
            error={emailError}
            disabled={saving}
            onChange={(value) => {
              setEmail(value);
              setEmailError(null);
            }}
          />

          {agency && !clientId ? (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium text-foreground">Access</legend>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as "member" | "client_user")} aria-label="Access">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = role === option.value;
                  return (
                    <label
                      key={option.value}
                      htmlFor={`invite-role-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
                        selected ? "border-primary bg-brand-tint/60" : "border-border-strong bg-card hover:bg-accent/60",
                      )}
                    >
                      <RadioGroupItem id={`invite-role-${option.value}`} value={option.value} className="mt-0.5" />
                      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{option.title}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </fieldset>
          ) : null}

          {role === "client_user" && !clientId ? <ClientChecklist label="Clients they can see" value={clientIds} onChange={setClientIds} /> : null}
          {role === "member" && agency ? <MemberClientScope limited={limited} onLimitedChange={setLimited} clientIds={clientIds} onClientIdsChange={setClientIds} /> : null}
          {role === "client_user" && clientId ? (
            <p className="rounded-lg bg-surface-strong px-3 py-2.5 text-xs text-muted-foreground">
              Client users can read their locations, reports and dashboard, and approve posts when client approval is on. They can't change anything else.
            </p>
          ) : null}

          {error ? <FormAlert>{error}</FormAlert> : null}

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving || undefined}>
              {saving ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />} {saving ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
