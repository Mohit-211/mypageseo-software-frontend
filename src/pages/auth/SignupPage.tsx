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
} from "@/components/mypageseo/auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { countries } from "@/lib/mypageseo/countries";
import type { AccountType } from "@/lib/mypageseo/navigation";
import { startOnboardingSession } from "@/lib/mypageseo/onboarding-state";

const title = "Create your Mypageseo account";
const description =
  "Set up a Business or Agency account to manage local search performance, Google Business Profiles, rankings and reporting.";



const signupSchema = z.object({
  accountType: z.enum(["business", "agency"]),
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
  organizationName: z
    .string()
    .trim()
    .min(2, { message: "Enter the organization name." })
    .max(120, { message: "Organization name must be under 120 characters." }),
  country: z.string().min(1, { message: "Select a country." }),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "Accept the terms to continue." }),
  }),
});

type FormValues = {
  accountType: AccountType;
  name: string;
  email: string;
  password: string;
  organizationName: string;
  country: string;
  acceptedTerms: boolean;
};

type FieldErrors = Partial<Record<keyof FormValues, string | undefined>>;

function SignupPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({
    accountType: "business",
    name: "",
    email: "",
    password: "",
    organizationName: "",
    country: "",
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAgency = values.accountType === "agency";

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

    setSubmitting(true);
    setFormError(null);
    try {
      // Account creation runs through the project's authentication backend,
      // which is not connected to this frontend yet. The details collected here
      // start a local setup session so onboarding continues; no account is
      // created until the authentication backend is connected.
      startOnboardingSession({
        accountType: result.data.accountType,
        organizationName: result.data.organizationName,
        country: result.data.country,
      });
      await navigate("/onboarding");
    } catch {
      setFormError(
        "We couldn't continue to setup right now. Please try again, or contact support if it keeps happening.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthHeading
        title={title}
        description="Your account will be used to manage local SEO performance across your locations."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {formError ? <AuthFormError message={formError} /> : null}

        <AuthOptionGroup<AccountType>
          legend="Account type"
          name="accountType"
          value={values.accountType}
          onChange={(value) => update("accountType", value)}
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

        <AuthField label="Full name" htmlFor="name" error={errors.name}>
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

        <AuthField label="Work email" htmlFor="email" error={errors.email}>
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
            label={isAgency ? "Agency name" : "Business name"}
            htmlFor="organizationName"
            error={errors.organizationName}
            hint={
              isAgency
                ? "The agency organization that will own this account."
                : "The business organization that will own this account."
            }
          >
            <AuthInput
              id="organizationName"
              name="organizationName"
              autoComplete="organization"
              placeholder={isAgency ? "Northbound Digital" : "Riverside Dental"}
              value={values.organizationName}
              invalid={Boolean(errors.organizationName)}
              onChange={(e) => update("organizationName", e.target.value)}
            />
          </AuthField>

          <AuthField label="Country" htmlFor="country" error={errors.country}>
            <select
              id="country"
              name="country"
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
              id="acceptedTerms"
              checked={values.acceptedTerms}
              onCheckedChange={(checked) => update("acceptedTerms", checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="acceptedTerms" className="text-[13px] leading-snug text-muted-foreground">
              I accept the Mypageseo terms of service and privacy policy, and agree to receive
              account and service notifications.
            </label>
          </div>
          {errors.acceptedTerms ? (
            <p className="text-xs font-medium text-critical">{errors.acceptedTerms}</p>
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
          {isAgency
            ? "Next: agency onboarding — add your first client and assign locations."
            : "Next: business onboarding — connect your first Google Business Profile location."}
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
