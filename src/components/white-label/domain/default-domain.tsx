import { Copy, Globe } from "lucide-react";
import { Panel } from "@/components/layout/shared/data-display";
import { Button } from "@/components/ui/button";
import { withScheme, type DomainSettings } from "@/lib/white-label/white-label";
import { copyText } from "../white-label-theme";
import { DomainStatusBadge } from "../white-label-ui";

export function DefaultDomain({ domain, exampleUrl, inUse }: { domain: DomainSettings; exampleUrl: string; inUse: boolean }) {
  return (
    <Panel title="Default White-Label Domain" description="A neutral domain with no MyPageSEO branding, ready to use.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-tint text-primary">
              <Globe className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{domain.defaultDomain}</p>
              <p className="text-xs text-muted-foreground">{inUse ? "Reports are currently served from this domain." : "Fallback while your custom domain is active."}</p>
            </div>
          </div>
          <DomainStatusBadge status={domain.defaultDomainStatus} />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground">Example client report URL</p>
          <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-background py-1 pl-3 pr-1">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{exampleUrl}</code>
            <Button type="button" size="sm" variant="ghost" onClick={() => void copyText(withScheme(exampleUrl), "Report link copied.")}>
              <Copy aria-hidden /> Copy
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}
