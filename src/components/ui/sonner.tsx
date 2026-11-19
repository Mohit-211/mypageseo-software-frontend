import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { inToast, windowOnScreen } from "./open-windows";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Typed toasts: a white card with a tinted, coloured icon per type (success green, error red,
 * warning amber, info blue), so success and failure never look alike. Sonner's own look is
 * switched off (`unstyled`) because its unlayered CSS would override Tailwind's layered
 * utilities; positioning, stacking and swipe still come from Sonner.
 *
 * Each toast takes pointer events itself (`pointer-events-auto`): an open dialog or sheet sets
 * `pointer-events: none` on <body>, which the toaster would inherit, so a click on a toast's
 * button would land on the dialog's backdrop and close the dialog instead. Only the toasts take
 * them, never the toaster's empty area. Sonner's own rule keeps hidden toasts (beyond the
 * visible three) out of reach. Windows ignore presses on a toast (ui/open-windows.ts), and a
 * press on a toast while one is open leaves the focus in the window: its focus trap would take
 * the focus back at once and select the text of the field it returns to (Radix selects an
 * <input>), so the next keystrokes would replace what was typed. Clicks, taps and swipes still
 * reach the toast.
 *
 * On touch screens the close button's hit area is 42 px (its ::after, from the padding box) and
 * the action buttons are 36 px tall, as the app's other touch targets. The close button is read
 * out as "Close this message".
 */
const ICON_BOX = "grid size-7 shrink-0 place-items-center rounded-full";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  useEffect(() => {
    const keepFocus = (event: MouseEvent) => {
      if (windowOnScreen() && inToast(event.target)) event.preventDefault();
    };
    document.addEventListener("mousedown", keepFocus, true);
    return () => document.removeEventListener("mousedown", keepFocus, true);
  }, []);
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
        closeButtonAriaLabel: "Close this message",
        ...toastOptions,
        unstyled: true,
        classNames: {
          toast:
            "group/toast pointer-events-auto flex w-(--width) items-start gap-3 rounded-xl border bg-popover p-4 font-sans text-popover-foreground shadow-elevated",
          content: "flex min-w-0 flex-1 flex-col gap-0.5 pt-1",
          title: "text-sm font-semibold leading-5 text-foreground",
          description: "text-[13px] leading-5 text-muted-foreground",
          icon: "flex shrink-0 items-center",
          actionButton:
            "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors outline-hidden hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:h-9",
          cancelButton:
            "inline-flex h-8 shrink-0 cursor-pointer items-center rounded-lg bg-secondary px-3 text-[13px] font-semibold text-secondary-foreground transition-colors outline-hidden hover:bg-brand-tint-strong/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:h-9",
          closeButton:
            "absolute -left-2 -top-2 grid size-6 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-xs outline-hidden hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']",
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
