import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLayout,
  AuthOptionGroup,
  AuthPasswordInput,
  AuthStatePanel,
} from "@/components/auth/auth";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, signup } from "@/api";
import type { SignupRequest, SignupResult } from "@/api";
import { GENERIC_AUTH_ERROR, emailSchema, passwordSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";

/** Signup is open to US and Canadian organizations only. */
const SIGNUP_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
] as const;
import type { AccountType } from "@/lib/mypageseo/navigation";

const signupSchema = z.object({
  account_type: z.enum(["business", "agency"]),
  name: z
    .string()
    .trim()
    .min(2, { message: "Enter your full name." })
    .max(150, { message: "Name must be under 150 characters." }),
  email: emailSchema,
  password: passwordSchema,
  organization_name: z
    .string()
    .trim()
    .min(2, { message: "Enter the organization name." })
    .max(150, { message: "Organization name must be under 150 characters." }),
  country: z.enum(["US", "CA"], { errorMap: () => ({ message: "Select a country." }) }),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: "Accept the terms to continue." }),
  }),
});

type FormValues = {
  account_type: AccountType;
  name: string;
  email: string;
  password: string;
  organization_name: string;
  country: string;
  accept_terms: boolean;
};

type FieldErrors = Partial<Record<keyof FormValues, string | undefined>>;

function SignupPage() {
  const [created, setCreated] = useState<{ email: string; result: SignupResult } | null>(null);
  const [values, setValues] = useState<FormValues>({
    account_type: "business",
    name: "",
    email: "",
    password: "",
    organization_name: "",
    country: "",
    accept_terms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAgency = values.account_type === "agency";

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  const parsed = signupSchema.safeParse(values);
  const canSubmit = parsed.success && !submitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const result = signupSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setFormError(null);
      return;
    }

    const payload: SignupRequest = result.data;

    setSubmitting(true);
    setFormError(null);
    try {
      setCreated({ email: payload.email, result: await signup(payload) });
    } catch (error) {
      if (isApiError(error) && error.reason === "email_taken") {
        setErrors({ email: "An account with this email already exists. Sign in instead." });
      } else if (isApiError(error) && error.status === 400 && /password/i.test(error.message)) {
        // A broken password rule comes back as a 400 whose message states the rule.
        setErrors({ password: error.message });
      } else {
        setFormError(
          rateLimitMessage(error) ??
            (isApiError(error) && error.status === 400 && error.message ? error.message : GENERIC_AUTH_ERROR),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const deadline = new Date(created.result.verify_before);
    return (
      <AuthLayout>
        <AuthStatePanel
          tone="success"
          icon={<MailCheck className="size-5" />}
          title="Check your email"
          description={
            <>
              We sent a verification link to <span className="font-medium text-foreground">{created.email}</span>. Open it to
              finish creating your account
              {Number.isNaN(deadline.getTime()) ? "" : ` before ${deadline.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}.
            </>
          }
        >
          <ResendVerification email={created.email} />
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading
        title="Create your Mypageseo account"
        description="Your account will be used to manage local SEO performance across your locations."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}

        <AuthOptionGroup<AccountType>
          legend="Account type"
          name="account_type"
          value={values.account_type}
          onChange={(value) => update("account_type", value)}
          options={[
            {
              value: "business",
              label: "Business",
              description: "Manage your own business locations.",
            },
            {
              value: "agency",
              label: "Agency",
              description: "Manage clients and their locations.",
            },
          ]}
        />

        <AuthField required label="Full name" htmlFor="name" error={errors.name}>
          <AuthInput
            id="name"
            name="name"
            autoComplete="name"
            placeholder="Jordan Reyes"
            value={values.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => update("name", e.target.value)}
          />
        </AuthField>

        <AuthField required label="Work email" htmlFor="email" error={errors.email}>
          <AuthInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(e) => update("email", e.target.value)}
          />
        </AuthField>

        <AuthField
          required
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        >
          <AuthPasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={values.password}
            invalid={Boolean(errors.password)}
            onChange={(e) => update("password", e.target.value)}
          />
        </AuthField>

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            required
            label={isAgency ? "Agency name" : "Business name"}
            htmlFor="organization_name"
            error={errors.organization_name}
          >
            <AuthInput
              id="organization_name"
              name="organization_name"
              autoComplete="organization"
              placeholder={isAgency ? "Northbound Digital" : "Riverside Dental"}
              value={values.organization_name}
              invalid={Boolean(errors.organization_name)}
              onChange={(e) => update("organization_name", e.target.value)}
            />
          </AuthField>

          <AuthField required label="Country" htmlFor="country" error={errors.country}>
            <select
              id="country"
              name="country"
              autoComplete="country"
              value={values.country}
              aria-invalid={Boolean(errors.country) || undefined}
              onChange={(e) => update("country", e.target.value)}
              className={`h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 ${
                errors.country ? "border-critical" : "border-input"
              } ${values.country ? "" : "text-muted-foreground"}`}
            >
              <option value="">Select a country</option>
              {SIGNUP_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </AuthField>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="accept_terms"
              checked={values.accept_terms}
              onCheckedChange={(checked) => update("accept_terms", checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="accept_terms" className="text-[13px] leading-snug text-muted-foreground">
              I accept the Mypageseo terms of service and privacy policy, and agree to receive
              account and service notifications.
              <span aria-hidden className="ml-0.5 text-critical">
                *
              </span>
            </label>
          </div>
          {errors.accept_terms ? (
            <p className="text-xs font-medium text-critical">{errors.accept_terms}</p>
          ) : null}
        </div>

        <Button type="submit" className="h-10 w-full" disabled={!canSubmit}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Next: open the verification link we email you.
        </p>
      </form>

      <AuthFooterNote>
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default SignupPage;
