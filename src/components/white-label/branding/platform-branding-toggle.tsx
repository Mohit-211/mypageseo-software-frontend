import { Check, EyeOff, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SHOWN = ["Agency logo", "Agency name", "Agency colors", "Agency domain"];
const HIDDEN = ["MyPageSEO logo", "MyPageSEO name", "MyPageSEO promotional links"];

function CheckList({ title, items, icon: Icon, muted }: { title: string; items: string[]; icon: typeof Check; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className={cn("flex items-center gap-2 text-sm", muted ? "text-muted-foreground" : "text-foreground")}>
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "White-Label Settings": hides MyPageSEO branding on client-facing reports. */
export function PlatformBrandingToggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background p-3.5">
        <div className="min-w-0">
          <Label htmlFor="hide-platform-branding" className="text-sm font-medium text-foreground">
            Hide MyPageSEO Branding
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {checked ? "Client-facing reports show only your agency branding." : "Reports include a small “Powered by MyPageSEO” credit in the footer."}
          </p>
        </div>
        <Switch id="hide-platform-branding" checked={checked} onCheckedChange={onCheckedChange} />
      </div>

      {checked ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <CheckList title="Client-facing reports show" items={SHOWN} icon={Check} />
            <CheckList title="Hidden from clients" items={HIDDEN} icon={EyeOff} muted />
          </div>
          <p className="flex items-start gap-2 rounded-md bg-secondary px-3 py-2.5 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Your clients will only see your agency branding on client-facing reports.
          </p>
        </>
      ) : null}
    </div>
  );
}
