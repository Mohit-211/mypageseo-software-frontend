import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
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
} from "@/components/auth/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isApiError, signup } from "@/api";
import type { SignupRequest } from "@/api";
import { countries } from "@/lib/mock-data/countries";
import type { AccountType } from "@/lib/mypageseo/navigation";

const signupSchema = z.object({
  account_type: z.enum(["business", "agency"]),
  name: z
    .string()
    .trim()
    .min(2, { message: "Enter your full name." })
    .max(100, { message: "Name must be under 100 characters." }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter your work email address." })
    .email({ message: "Enter a valid email address." })
    .max(255, { message: "Email must be under 255 characters." }),
  password: z
    .string()
    .min(8, { message: "Use at least 8 characters." })
    .max(128, { message: "Password must be under 128 characters." })
    .regex(/[A-Za-z]/, { message: "Include at least one letter and one number." })
    .regex(/[0-9]/, { message: "Include at least one letter and one number." }),
  organization_name: z
    .string()
    .trim()
    .min(2, { message: "Enter the organization name." })
    .max(120, { message: "Organization name must be under 120 characters." }),
  country: z.string().length(2, { message: "Select a country." }),
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
  const navigate = useNavigate();
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
      // await signup(payload);
     
      // await navigate(`/verify-otp?email=${encodeURIComponent(payload.email)}&type=EMAIL_VERIFICATION`);
    await signup(payload);
await navigate(`/verify-email?email=${encodeURIComponent(payload.email)}`);

      
    } catch (error) {
      if (isApiError(error) && error.fieldErrors) {
        const next: FieldErrors = {};
        for (const [key, message] of Object.entries(error.fieldErrors)) {
          if (key in values) next[key as keyof FormValues] = message;
        }
        setErrors(next);
      }
      setFormError(
        isApiError(error) && error.status > 0 && error.status < 500
          ? error.message
          : "We couldn't create your account right now. Please try again, or contact support if it keeps happening.",
      );
    } finally {
      setSubmitting(false);
    }
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
              {countries.map((country) => (
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
          Next: verify your email with the one-time code we send you.
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
