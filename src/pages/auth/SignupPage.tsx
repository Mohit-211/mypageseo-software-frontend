import { useState } from "react";
import { Building2, Loader2, MailCheck, Users } from "lucide-react";
import { z } from "zod";
import {
  AuthField,
  AuthFooterNote,
  AuthFormError,
  AuthHeading,
  AuthInput,
  AuthLayout,
  AuthLink,
  AuthOptionGroup,
  AuthPasswordInput,
  AuthStatePanel,
} from "@/components/auth/auth";
import { ResendVerification } from "@/components/auth/resend-verification";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, signup } from "@/api";
import type { SignupRequest, SignupResult } from "@/api";
import { formatDateTime } from "@/lib/datetime";
import { GENERIC_AUTH_ERROR, emailSchema, passwordSchema, rateLimitMessage } from "@/lib/auth/auth-recovery";
import type { AccountType } from "@/lib/mypageseo/navigation";
import { cn } from "@/lib/utils";

/** Signup is open to US and Canadian organizations only. */
const SIGNUP_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
] as const;

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

/** The id of each field's control, so a failed submit can move focus to the first problem. */
const FIELD_IDS: Record<keyof FormValues, string> = {
  account_type: "signup-account-type",
  name: "signup-name",
  email: "signup-email",
  password: "signup-password",
  organization_name: "signup-organization",
  country: "signup-country",
  accept_terms: "signup-terms",
};

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

  /** Shows every problem at once and puts the cursor on the first one. */
  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = (Object.keys(FIELD_IDS) as (keyof FormValues)[]).find((key) => next[key]);
    if (first) document.getElementById(FIELD_IDS[first])?.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // The button stays enabled: a click on an incomplete form explains what's missing instead of doing nothing.
    const result = signupSchema.safeParse(values);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FormValues;
        if (key && !next[key]) next[key] = issue.message;
      }
      setFormError(null);
      showErrors(next);
      return;
    }

    const payload: SignupRequest = result.data;

    setSubmitting(true);
    setFormError(null);
    try {
      setCreated({ email: payload.email, result: await signup(payload) });
    } catch (error) {
      if (isApiError(error) && error.reason === "email_taken") {
        showErrors({ email: "An account with this email already exists. Sign in instead." });
      } else if (isApiError(error) && error.status === 400 && /password/i.test(error.message)) {
        // A broken password rule comes back as a 400 whose message states the rule.
        showErrors({ password: error.message });
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
    const deadline = formatDateTime(created.result.verify_before, "");
    return (
      <AuthLayout showcase>
        <AuthStatePanel
          tone="success"
          icon={<MailCheck />}
          title="Check your email"
          description={
            <>
              We sent a verification link to <span className="font-medium text-foreground">{created.email}</span>. Open
              it to finish creating your account{deadline ? ` before ${deadline}` : ""}. Accounts that aren&apos;t
              verified within 24 hours are deleted, and you&apos;d need to sign up again.
            </>
          }
        >
          <ResendVerification email={created.email} />
          <p className="text-center text-sm text-muted-foreground">
            Already verified? <AuthLink to="/login">Sign in</AuthLink>
          </p>
        </AuthStatePanel>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout showcase>
      <AuthHeading
        title="Create your MyPageSEO account"
        description="It takes a minute. We'll email you a link to confirm your address."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
              icon: Building2,
            },
            {
              value: "agency",
              label: "Agency",
              description: "Manage clients and their locations.",
              icon: Users,
            },
          ]}
        />

        <AuthField required label="Full name" htmlFor={FIELD_IDS.name} error={errors.name}>
          <AuthInput
            id={FIELD_IDS.name}
            name="name"
            autoComplete="name"
            placeholder="Jordan Reyes"
            required
            value={values.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => update("name", e.target.value)}
          />
        </AuthField>

        <AuthField required label="Work email" htmlFor={FIELD_IDS.email} error={errors.email}>
          <AuthInput
            id={FIELD_IDS.email}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@company.com"
            required
            value={values.email}
            invalid={Boolean(errors.email)}
            onChange={(e) => update("email", e.target.value)}
          />
        </AuthField>

        <AuthField
          required
          label="Password"
          htmlFor={FIELD_IDS.password}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        >
          <AuthPasswordInput
            id={FIELD_IDS.password}
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            required
            value={values.password}
            invalid={Boolean(errors.password)}
            onChange={(e) => update("password", e.target.value)}
          />
        </AuthField>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
          <AuthField
            required
            label={isAgency ? "Agency name" : "Business name"}
            htmlFor={FIELD_IDS.organization_name}
            error={errors.organization_name}
          >
            <AuthInput
              id={FIELD_IDS.organization_name}
              name="organization_name"
              autoComplete="organization"
              placeholder={isAgency ? "Northbound Digital" : "Riverside Dental"}
              required
              value={values.organization_name}
              invalid={Boolean(errors.organization_name)}
              onChange={(e) => update("organization_name", e.target.value)}
            />
          </AuthField>

          <AuthField required label="Country" htmlFor={FIELD_IDS.country} error={errors.country}>
            <select
              id={FIELD_IDS.country}
              name="country"
              autoComplete="country"
              required
              value={values.country}
              aria-invalid={Boolean(errors.country) || undefined}
              aria-describedby={errors.country ? `${FIELD_IDS.country}-error` : undefined}
              onChange={(e) => update("country", e.target.value)}
              className={cn(
                "h-11 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-base shadow-xs transition-[border-color,box-shadow] outline-hidden hover:border-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 aria-invalid:border-critical aria-invalid:focus-visible:ring-critical/25 md:text-sm",
                values.country ? "text-foreground" : "text-muted-foreground",
              )}
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

        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id={FIELD_IDS.accept_terms}
              checked={values.accept_terms}
              onCheckedChange={(checked) => update("accept_terms", checked === true)}
              aria-invalid={Boolean(errors.accept_terms) || undefined}
              aria-describedby={errors.accept_terms ? `${FIELD_IDS.accept_terms}-error` : undefined}
              required
              className="mt-0.5"
            />
            <label htmlFor={FIELD_IDS.accept_terms} className="cursor-pointer text-sm leading-snug text-muted-foreground">
              I accept the MyPageSEO terms of service and privacy policy, and agree to receive account and service
              emails.
              <span aria-hidden className="ml-0.5 text-critical">
                *
              </span>
            </label>
          </div>
          {errors.accept_terms ? (
            <p id={`${FIELD_IDS.accept_terms}-error`} className="pl-7 text-xs font-medium text-critical">
              {errors.accept_terms}
            </p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Creating account…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">Next: open the verification link we email you.</p>
      </form>

      <AuthFooterNote>
        Already have an account? <AuthLink to="/login">Sign in</AuthLink>
      </AuthFooterNote>
    </AuthLayout>
  );
}

export default SignupPage;
