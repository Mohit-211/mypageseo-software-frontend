import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Typed toasts: a white card with a tinted, coloured icon per type (success green, error red,
 * warning amber, info blue), so success and failure never look alike. Sonner's own look is
 * switched off (`unstyled`) because its unlayered CSS would override Tailwind's layered
 * utilities; positioning, stacking and swipe still come from Sonner.
 */
const ICON_BOX = "grid size-7 shrink-0 place-items-center rounded-full";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: (
          <span className={`${ICON_BOX} bg-success-surface text-success`}>
            <CheckCircle2 className="size-4" aria-hidden />
          </span>
        ),
        error: (
          <span className={`${ICON_BOX} bg-critical-surface text-critical`}>
            <XCircle className="size-4" aria-hidden />
          </span>
        ),
        warning: (
          <span className={`${ICON_BOX} bg-warning-surface text-warning`}>
            <AlertTriangle className="size-4" aria-hidden />
          </span>
        ),
        info: (
          <span className={`${ICON_BOX} bg-info-surface text-info`}>
            <Info className="size-4" aria-hidden />
          </span>
        ),
        loading: (
          <span className={`${ICON_BOX} bg-brand-tint text-primary`}>
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </span>
        ),
      }}
      {...props}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        classNames: {
          toast:
            "group/toast flex w-(--width) items-start gap-3 rounded-xl border bg-popover p-4 font-sans text-popover-foreground shadow-elevated",
          content: "flex min-w-0 flex-1 flex-col gap-0.5 pt-1",
          title: "text-sm font-semibold leading-5 text-foreground",
          description: "text-[13px] leading-5 text-muted-foreground",
          icon: "flex shrink-0 items-center",
          actionButton:
            "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors outline-hidden hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          cancelButton:
            "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground transition-colors outline-hidden hover:bg-brand-tint-strong/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          closeButton:
            "absolute -left-2 -top-2 grid size-6 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-xs outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          // Border colour per type (not on `toast`, so two border colours never compete).
          default: "border-border",
          loading: "border-border",
          success: "border-success/30",
          error: "border-critical/30",
          warning: "border-warning/40",
          info: "border-info/30",
          ...toastOptions?.classNames,
        },
      }}
    />
  );
};

export { Toaster };
