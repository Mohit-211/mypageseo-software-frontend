import type { ClientRecord } from "@/api";
import { Label } from "@/components/ui/label";
import { useClientRequired } from "@/lib/clients/clients";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NO_CLIENT = "__none__";

/**
 * The client for a location. Usually optional ("No client" allowed); for a member limited to
 * its clients it's required and lists only its clients (the backend already limits the list).
 */
export function ClientSelect({
  id,
  clients,
  value,
  onChange,
  label,
}: {
  id: string;
  clients: ClientRecord[];
  value: string | null;
  onChange: (clientId: string | null) => void;
  label?: string;
}) {
  const required = useClientRequired();
  if (required && clients.length === 0) {
    return <p className="text-sm text-warning-foreground">No clients are assigned to you yet. Ask the account owner to give you a client.</p>;
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label ?? (required ? "Client" : "Client (optional)")}</Label>
      <Select value={value ?? (required ? "" : NO_CLIENT)} onValueChange={(next) => onChange(next === NO_CLIENT ? null : next)}>
        <SelectTrigger id={id} className="bg-background">
          <SelectValue placeholder={required ? "Choose one of your clients" : "No client"} />
        </SelectTrigger>
        <SelectContent>
          {required ? null : <SelectItem value={NO_CLIENT}>No client</SelectItem>}
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
