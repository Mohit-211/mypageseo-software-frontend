import { FileText, Globe, Palette, Plus } from "lucide-react";
import { EmptyState } from "@/components/layout/shared/feedback/states";
import { Button } from "@/components/ui/button";

export function BrandingNotConfiguredEmpty({ onConfigure, className }: { onConfigure: () => void; className?: string }) {
  return (
    <EmptyState
      icon={Palette}
      title="Set up your agency branding"
      description="Add your logo, company name and brand colors to create a branded client experience."
      action={
        <Button onClick={onConfigure}>
          <Palette aria-hidden /> Configure Branding
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}

export function NoClientReportsEmpty({ onCreate, className }: { onCreate: () => void; className?: string }) {
  return (
    <EmptyState
      icon={FileText}
      title="No client reports yet"
      description="Create a client report to start sharing branded reports."
      action={
        <Button onClick={onCreate}>
          <Plus aria-hidden /> Create Client Report
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}

export function DomainNotConfiguredEmpty({ onConfigure, className }: { onConfigure: () => void; className?: string }) {
  return (
    <EmptyState
      compact
      icon={Globe}
      title="Set up your client-facing domain"
      description="Connect your own domain so clients open reports on an address that carries your brand."
      action={
        <Button size="sm" onClick={onConfigure}>
          <Globe aria-hidden /> Configure Domain
        </Button>
      }
      {...(className ? { className } : {})}
    />
  );
}
