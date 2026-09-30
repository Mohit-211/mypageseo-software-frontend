import { Link2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGbpConnect } from "@/lib/gbp/use-gbp-connect";
import { cn } from "@/lib/utils";

/** Button that sends the user to Google to connect their Business Profile. */
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
  const { connect, connecting, error } = useGbpConnect();

  return (
    <div className={cn(fullWidth ? "flex w-full" : "inline-flex max-w-full", "flex-col gap-1.5", className)}>
      <Button
        size={size}
        variant={variant}
        disabled={connecting}
        aria-busy={connecting}
        onClick={() => void connect()}
        className={cn(fullWidth && "w-full")}
      >
        {connecting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Link2 aria-hidden />}
        {connecting ? "Connecting to Google…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}
