import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWorkspace } from "@/lib/mypageseo/workspace";

/** Tick the clients someone may see. */
export function ClientChecklist({ value, onChange, label }: { value: string[]; onChange: (ids: string[]) => void; label: string }) {
  const workspace = useWorkspace();
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {workspace.clients.length === 0 ? (
        <p className="text-xs text-muted-foreground">There are no clients yet. Create one under Clients first.</p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {workspace.clients.map((client) => (
            <li key={client.id}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={value.includes(client.id)}
                  onCheckedChange={(checked) => onChange(checked === true ? [...value, client.id] : value.filter((id) => id !== client.id))}
                />
                {client.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <div className="space-y-2">
      <Label>Clients they work on</Label>
      <RadioGroup value={limited ? "some" : "all"} onValueChange={(value) => onLimitedChange(value === "some")} className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="all" /> All clients
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="some" /> Only these clients
        </label>
      </RadioGroup>
      {limited ? (
        <>
          <ClientChecklist label="Their clients" value={clientIds} onChange={onClientIdsChange} />
          <p className="text-xs text-muted-foreground">They can do everything a member can, but only for these clients' locations. Other locations stay hidden from them.</p>
        </>
      ) : null}
    </div>
  );
}
