import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { cn } from "@/lib/utils";

/** Opens the Google Business Profile connect modal (connect an account, then pick locations). */
export function ConnectGbpButton({
  label = "Connect Google",
  size = "sm",
  variant = "default",
  fullWidth = false,
  className,
}: {
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
  fullWidth?: boolean;
  className?: string;
}) {
  const { connect } = useGbpConnect();

  return (
    <div className={cn(fullWidth ? "flex w-full" : "inline-flex max-w-full", "flex-col gap-1.5", className)}>
      <Button size={size} variant={variant} onClick={() => connect()} className={cn(fullWidth && "w-full")}>
        <Link2 aria-hidden />
        {label}
      </Button>
    </div>
  );
}
