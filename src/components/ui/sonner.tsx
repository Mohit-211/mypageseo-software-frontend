import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { Toaster as Sonner } from "sonner";
import { cn } from "@/lib/utils";
import { inToast, pressOnToast, windowOnScreen } from "./open-windows";
import { useToastsWaitForWindows } from "./toast-hold";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Typed toasts: a white card with a tinted, coloured icon per type (success green, error red,
 * warning amber, info blue), so success and failure never look alike. Sonner's own look is
 * switched off (`unstyled`) because its unlayered CSS would override Tailwind's layered
 * utilities; positioning, stacking and swipe still come from Sonner.
 *
 * A toast never takes a press meant for an open window (ui/toast-hold.ts): while one is open, a
 * toast with a button waits out of sight and comes back once every window is closed, and a toast
 * without buttons still shows but lets presses through to the window (`pointer-events-none`); a
 * press at its place over the backdrop does nothing (it neither closes the window nor moves focus).
 * With no window open, a toast with a button takes pointer events itself
 * (`pointer-events-auto`): a modal menu or popover sets `pointer-events: none` on <body>, which
 * the toaster would inherit. Only the toasts take them, never the toaster's empty area. Sonner's
 * own rule keeps hidden toasts (beyond the visible three) out of reach. Windows ignore presses on
 * a toast (ui/open-windows.ts), and a press on a toast while one is open leaves the focus in the
 * window: its focus trap would take the focus back at once and select the text of the field it
 * returns to (Radix selects an <input>), so the next keystrokes would replace what was typed.
 *
 * On touch screens the close button's hit area is 42 px (its ::after, from the padding box) and
 * the action buttons are 36 px tall, as the app's other touch targets. The close button is read
 * out as "Close this message".
 */
const ICON_BOX = "grid size-7 shrink-0 place-items-center rounded-full";

const Toaster = ({ toastOptions, className, ...props }: ToasterProps) => {
  const windowOpen = useToastsWaitForWindows();
  useEffect(() => {
    const keepFocus = (event: MouseEvent) => {
      if (!windowOnScreen()) return;
      // On a toast, or at the place of one without buttons over a window's backdrop (a press over the window itself
      // goes to the window).
      const target = event.target;
      const overWindow = target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]') !== null;
      if (inToast(target) || (!overWindow && pressOnToast(event))) event.preventDefault();
    };
    document.addEventListener("mousedown", keepFocus, true);
    return () => document.removeEventListener("mousedown", keepFocus, true);
  }, []);
  return (
    <Sonner
      // `windows-open`: a window is open (the toasts' look below).
      className={cn("toaster group", windowOpen && "windows-open", className)}
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
          // With a window open: a toast with a button is hidden until it is moved to wait (ui/toast-hold.ts), and the
          // others let presses through.
          toast:
            "group/toast flex w-(--width) items-start gap-3 rounded-xl border bg-popover p-4 font-sans text-popover-foreground shadow-elevated has-[[data-button]]:pointer-events-auto has-[[data-close-button]]:pointer-events-auto group-[.windows-open]:pointer-events-none group-[.windows-open]:has-[[data-button]]:hidden group-[.windows-open]:has-[[data-close-button]]:hidden",
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
