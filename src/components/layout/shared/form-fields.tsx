import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, Save } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Canonical MyPageSEO form primitives.
 *
 * Every application form (settings, team, reports, automations, clients,
 * white-label, onboarding) composes these so labels, required markers,
 * spacing, helper text, validation messages, disabled/saving states and
 * success feedback stay identical across the product.
 *
 * Validation rules themselves live in the `src/lib/mypageseo/*` contracts —
 * these components only present the result, including errors surfaced by a
 * backend, so no rule is duplicated or invented here.
 */

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

/** Standard two-column field grid with consistent field spacing. */
export function FormGrid({
  columns = 2,
  className,
  children,
}: {
  columns?: 1 | 2;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-5", columns === 2 && "sm:grid-cols-2", className)}>{children}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field messages                                                             */
/* -------------------------------------------------------------------------- */

/** Single helper/validation line below a control. Errors always win over hints. */
export function FieldMessage({
  id,
  error,
  hint,
}: {
  id?: string | undefined;
  error?: string | null | undefined;
  hint?: ReactNode;
}) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1.5 flex items-start gap-1 text-xs font-medium text-critical">
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>{error}</span>
      </p>
    );
  }
  if (hint) {
    return (
      <p id={id} className="mt-1.5 text-xs text-muted-foreground">
        {hint}
      </p>
    );
  }
  return null;
}

/** Label + required/optional marker + control + one message line. */
export function FormField({
  label,
  htmlFor,
  required,
  optional,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  error?: string | null | undefined;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="text-sm font-medium leading-5 text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-critical" aria-hidden>
            *
          </span>
        ) : null}
        {!required && optional ? (
          <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
        ) : null}
      </Label>
      <div className="mt-1.5">{children}</div>
      <FieldMessage id={`${htmlFor}-message`} error={error} hint={hint} />
    </div>
  );
}

/** Explains the required marker once per form. */
export function RequiredFieldsNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Fields marked <span className="text-critical">*</span> are required.
    </p>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                   */
/* -------------------------------------------------------------------------- */

export function FormTextField({
  id,
  label,
  value,
  onChange,
  required,
  optional,
  error,
  hint,
  disabled,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  error?: string | null | undefined;
  hint?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange" | "className">) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      {...(required === undefined ? {} : { required })}
      {...(optional === undefined ? {} : { optional })}
      error={error}
      hint={hint}
      {...(className ? { className } : {})}
    >
      <Input
        {...inputProps}
        id={id}
        value={value}
        disabled={disabled ?? false}
        required={required ?? false}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-message`}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

export function FormTextareaField({
  id,
  label,
  value,
  onChange,
  required,
  optional,
  error,
  hint,
  disabled,
  className,
  ...textareaProps
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  error?: string | null | undefined;
  hint?: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Textarea>, "id" | "value" | "onChange" | "className">) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      {...(required === undefined ? {} : { required })}
      {...(optional === undefined ? {} : { optional })}
      error={error}
      hint={hint}
      {...(className ? { className } : {})}
    >
      <Textarea
        {...textareaProps}
        id={id}
        value={value}
        disabled={disabled ?? false}
        required={required ?? false}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-message`}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

export function FormSelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  optional,
  error,
  hint,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  error?: string | null | undefined;
  hint?: ReactNode;
  disabled?: boolean | undefined;
  className?: string;
}) {
  return (
    <FormField
      label={label}
      htmlFor={id}
      {...(required === undefined ? {} : { required })}
      {...(optional === undefined ? {} : { optional })}
      error={error}
      hint={hint}
      {...(className ? { className } : {})}
    >
      <Select value={value} onValueChange={onChange} disabled={disabled ?? false}>
        <SelectTrigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-message`}
          className="w-full"
        >
          <SelectValue placeholder={placeholder ?? `Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/* -------------------------------------------------------------------------- */
/* Form-level messages                                                        */
/* -------------------------------------------------------------------------- */

export type FormAlertTone = "critical" | "warning" | "info" | "success";

/**
 * Form-level message: a failed submission, a surfaced backend error, or an
 * explanation of why an action is currently unavailable.
 */
export function FormAlert({
  tone = "critical",
  title,
  children,
  className,
}: {
  tone?: FormAlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : tone === "warning" ? AlertTriangle : AlertCircle;
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm text-foreground",
        tone === "critical" && "border-critical/30 bg-critical-surface",
        tone === "warning" && "border-warning/40 bg-warning-surface",
        tone === "success" && "border-success/30 bg-success-surface",
        tone === "info" && "border-info/30 bg-info-surface",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "critical" && "text-critical",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "info" && "text-info",
        )}
        aria-hidden
      />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn("text-sm", title && "mt-0.5 text-muted-foreground")}>{children}</div>
      </div>
    </div>
  );
}

/** Standard message shown when submission was blocked by field validation. */
export const FORM_VALIDATION_SUMMARY = "Fix the highlighted fields before saving.";

/* -------------------------------------------------------------------------- */
/* Submission                                                                 */
/* -------------------------------------------------------------------------- */

/** Primary submit button with a consistent saving state. */
export function SubmitButton({
  pending,
  children,
  pendingLabel = "Saving…",
  icon,
  ...props
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  icon?: ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "children">) {
  return (
    <Button {...props} type={props.type ?? "submit"} disabled={pending || props.disabled} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Save bar                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sticky save/discard bar used by every settings-style form so unsaved
 * changes, validation state, errors and success feedback read the same way.
 */
export function FormSaveBar({
  dirty,
  canSave,
  statusText,
  saving,
  hasErrors,
  savedAt,
  error,
  disabled,
  onSave,
  onDiscard,
  savedLabel = "Changes saved",
  pendingLabel,
}: {
  /** The form differs from what's saved: "You have unsaved changes." and Discard. */
  dirty: boolean;
  /**
   * Save is possible (defaults to `dirty`). True without `dirty` for a form that was never saved and
   * can be saved as it is; Discard stays off then, since there is nothing to undo.
   */
  canSave?: boolean | undefined;
  /** The status line when there is nothing else to say (no error, no unsaved changes, not just saved). */
  statusText?: ReactNode;
  saving: boolean;
  hasErrors: boolean;
  savedAt: string | null;
  error: string | null;
  disabled?: boolean | undefined;
  onSave: () => void;
  onDiscard: () => void;
  savedLabel?: string;
  /** Label on the save button while saving (defaults to "Saving…"). */
  pendingLabel?: string;
}) {
  const saveable = canSave ?? dirty;
  return (
    // Floats at the bottom of the viewport while the form scrolls; it lifts (stronger shadow, teal
    // edge) when there is something to save.
    <div
      className={cn(
        "sticky bottom-3 z-20 rounded-xl border bg-card/95 px-4 py-3 backdrop-blur transition-[box-shadow,border-color] supports-[backdrop-filter]:bg-card/85",
        saveable ? "border-primary/35 shadow-elevated" : "border-border shadow-card",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-5 text-sm" aria-live="polite">
          {error ? (
            <span className="flex items-center gap-1.5 font-medium text-critical">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {error}
            </span>
          ) : hasErrors ? (
            <span className="flex items-center gap-1.5 font-medium text-critical">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {FORM_VALIDATION_SUMMARY}
            </span>
          ) : savedAt ? (
            <span className="flex items-center gap-1.5 font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {savedLabel} at {savedAt}
            </span>
          ) : dirty ? (
            <span className="flex items-center gap-2 text-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
              You have unsaved changes.
            </span>
          ) : statusText ? (
            <span className="flex items-center gap-2 text-foreground">
              <Info className="size-4 shrink-0 text-info" aria-hidden />
              {statusText}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={!dirty || saving || disabled}
          >
            Discard changes
          </Button>
          <SubmitButton
            type="button"
            pending={saving}
            {...(pendingLabel ? { pendingLabel } : {})}
            onClick={onSave}
            disabled={!saveable || disabled}
            icon={<Save className="size-4" aria-hidden />}
          >
            Save changes
          </SubmitButton>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Destructive confirmation                                                   */
/* -------------------------------------------------------------------------- */

/** Canonical confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
