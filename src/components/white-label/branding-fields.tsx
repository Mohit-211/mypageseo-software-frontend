import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HEX } from "@/lib/white-label/branding";

/** A colour picker with its hex value. An empty value (with a `placeholder`) means "use the default". */
export function ColorField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const shown = HEX.test(value) ? value : placeholder && HEX.test(placeholder) ? placeholder : "#000000";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} className="size-9 shrink-0 cursor-pointer rounded border border-border bg-background" value={shown} onChange={(event) => onChange(event.target.value)} />
        <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  );
}
