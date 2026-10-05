import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout/shared/data-display";
import { FormField, SubmitButton } from "@/components/layout/shared/form-fields";
import { useSubmitGuard } from "@/hooks/use-submit-guard";
import { Input } from "@/components/ui/input";
import { normalizeHostname, whiteLabelActions, type CustomDomain as CustomDomainModel } from "@/lib/white-label/white-label";
import { DomainNotConfiguredEmpty } from "../empty-states";
import { DnsSetup } from "./dns-setup";
import { DomainStatus } from "./domain-status";

export const CUSTOM_DOMAIN_INPUT_ID = "custom-domain";

export function CustomDomain({
  domain,
  defaultDomain,
  verifying,
  placeholder,
}: {
  domain: CustomDomainModel | null;
  defaultDomain: string;
  verifying: boolean;
  placeholder: string;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useSubmitGuard();

  const connect = () => {
    const hostname = normalizeHostname(value);
    if (!hostname) {
      setError("Enter a valid domain, e.g. reports.yourdomain.com.");
      return;
    }
    if (hostname === defaultDomain || hostname.endsWith(`.${defaultDomain}`)) {
      setError("Use a domain your agency owns.");
      return;
    }
    setError(null);
    void run(async () => {
      await whiteLabelActions.connectCustomDomain(hostname);
      setValue("");
      setFormOpen(false);
      toast.success("Domain added", { description: "Add the DNS records below, then verify the domain." });
    });
  };

  const remove = async () => {
    await whiteLabelActions.removeCustomDomain();
    toast.success("Custom domain removed", { description: `Reports are served from ${defaultDomain} again.` });
  };

  return (
    <Panel title="Custom Domain" description="Connect your own domain for a fully branded client experience.">
      {domain ? (
        domain.status === "connected" ? (
          <DomainStatus domain={domain} checking={verifying} onRecheck={() => void whiteLabelActions.verifyDomain()} onRemove={() => void remove()} />
        ) : (
          <DnsSetup domain={domain} checking={verifying} onVerify={() => void whiteLabelActions.verifyDomain()} onRemove={() => void remove()} />
        )
      ) : formOpen ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <FormField
            label="Domain"
            htmlFor={CUSTOM_DOMAIN_INPUT_ID}
            error={error}
            hint="Use a subdomain such as reports.yourdomain.com. Your main website is not affected."
            className="min-w-0 flex-1"
          >
            <Input
              id={CUSTOM_DOMAIN_INPUT_ID}
              value={value}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${CUSTOM_DOMAIN_INPUT_ID}-message`}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
          </FormField>
          <SubmitButton pending={pending} pendingLabel="Connecting…" icon={<Link2 aria-hidden />} className="sm:mt-[26px]">
            Connect Domain
          </SubmitButton>
        </form>
      ) : (
        <DomainNotConfiguredEmpty onConfigure={() => setFormOpen(true)} />
      )}
    </Panel>
  );
}
