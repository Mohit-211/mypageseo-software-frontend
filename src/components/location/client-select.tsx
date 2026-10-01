import type { ClientRecord } from "@/api";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_CLIENT = "__none__";

/** Optional client for a location. Clients are only a grouping, so "No client" is always allowed. */
export function ClientSelect({
  id,
  clients,
  value,
  onChange,
  label = "Client (optional)",
}: {
  id: string;
  clients: ClientRecord[];
  value: string | null;
  onChange: (clientId: string | null) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? NO_CLIENT} onValueChange={(next) => onChange(next === NO_CLIENT ? null : next)}>
        <SelectTrigger id={id} className="bg-background">
          <SelectValue placeholder="No client" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CLIENT}>No client</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.client_id} value={client.client_id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
