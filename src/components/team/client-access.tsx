import { Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWorkspace } from "@/lib/mypageseo/workspace";
import { byText, sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** Tick the clients someone may see. */
export function ClientChecklist({ value, onChange, label }: { value: string[]; onChange: (ids: string[]) => void; label: string }) {
  const workspace = useWorkspace();
  const clients = sortRows(workspace.clients, byText((client) => client.name));
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {clients.length === 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-sm text-muted-foreground">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            There are no clients yet.{" "}
            <Link to="/clients" className="font-medium text-primary underline-offset-2 hover:underline">
              Create one under Clients
            </Link>{" "}
            first.
          </span>
        </p>
      ) : (
        <ul className="max-h-44 divide-y divide-border overflow-y-auto rounded-lg border border-input bg-card">
          {clients.map((client) => {
            const checked = value.includes(client.id);
            return (
              <li key={client.id}>
                <label className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-accent/60", checked && "bg-brand-tint/60")}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => onChange(next === true ? [...value, client.id] : value.filter((id) => id !== client.id))}
                  />
                  <span className="text-foreground">{client.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {clients.length > 0 ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {value.length === 0 ? "Pick at least one client." : `${value.length} of ${clients.length} selected`}
        </p>
      ) : null}
    </fieldset>
  );
}

/** One option of a choice list, laid out as a card: the radio, a title and a line of help. */
function OptionCard({ value, title, description, selected }: { value: string; title: string; description: string; selected: boolean }) {
  const id = `client-scope-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
        selected ? "border-primary bg-brand-tint/60" : "border-border-strong bg-card hover:bg-accent/60",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/**
 * A member's reach (Phase 21): every client, or only some. A limited member keeps a member's
 * write access, but only for the locations of its clients.
 */
export function MemberClientScope({
  limited,
  onLimitedChange,
  clientIds,
  onClientIdsChange,
}: {
  limited: boolean;
  onLimitedChange: (limited: boolean) => void;
  clientIds: string[];
  onClientIdsChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Clients they work on</p>
        <RadioGroup value={limited ? "some" : "all"} onValueChange={(value) => onLimitedChange(value === "some")} aria-label="Clients they work on">
          <OptionCard value="all" title="All clients" description="Every location in your organization." selected={!limited} />
          <OptionCard value="some" title="Only some clients" description="Just the locations of the clients you pick." selected={limited} />
        </RadioGroup>
      </div>
      {limited ? (
        <>
          <ClientChecklist label="Their clients" value={clientIds} onChange={onClientIdsChange} />
          <p className="text-xs text-muted-foreground">They can do everything a member can, but only for these clients' locations. Other locations stay hidden from them.</p>
        </>
      ) : null}
    </div>
  );
}
