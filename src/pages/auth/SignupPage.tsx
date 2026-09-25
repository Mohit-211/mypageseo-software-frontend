import { useEffect, useState } from "react";
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
import { getCities, getCountries, getStates, isApiError, signup } from "@/api";
import type { LocationOption, SignupRequest } from "@/api";
import type { AccountType } from "@/lib/mypageseo/navigation";

const signupSchema = z
  .object({
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
    mobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, { message: "Enter a valid mobile number." }),
    password: z
      .string()
      .min(8, { message: "Use at least 8 characters." })
      .max(128, { message: "Password must be under 128 characters." })
      .regex(/[A-Za-z]/, { message: "Include at least one letter and one number." })
      .regex(/[0-9]/, { message: "Include at least one letter and one number." }),
    confirm_password: z.string().min(1, { message: "Confirm your password." }),
    business_name: z
      .string()
      .trim()
      .min(2, { message: "Enter the organization name." })
      .max(120, { message: "Organization name must be under 120 characters." }),
    website_url: z
      .string()
      .trim()
      .url({ message: "Enter a full URL, e.g. https://example.com." }),
    business_address: z
      .string()
      .trim()
      .min(3, { message: "Enter the business address." })
      .max(255, { message: "Address must be under 255 characters." }),
    country_id: z.string().min(1, { message: "Select a country." }),
    state_id: z.string().min(1, { message: "Select a state." }),
    city_id: z.string().min(1, { message: "Select a city." }),
    zip_code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9 -]{3,10}$/, { message: "Enter a valid ZIP / postal code." }),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "Accept the terms to continue." }),
    }),
  })
  .refine((v) => v.password === v.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords don't match.",
  });

type FormValues = {
  accountType: AccountType;
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirm_password: string;
  business_name: string;
  website_url: string;
  business_address: string;
  country_id: string;
  state_id: string;
  city_id: string;
  zip_code: string;
  acceptedTerms: boolean;
};

type FieldErrors = Partial<Record<keyof FormValues, string | undefined>>;

type LocationList = { options: LocationOption[]; loading: boolean; error: boolean };

/** Loads a location list whenever `parentId` changes; `null` skips the fetch. */
function useLocationList(
  parentId: string | null,
  load: (parentId: string, signal: AbortSignal) => Promise<LocationOption[]>,
): LocationList {
  // Results are keyed by the parent they were loaded for, so a stale list is
  // never shown after the parent changes.
  const [result, setResult] = useState<{ key: string; options: LocationOption[]; error: boolean }>();

  useEffect(() => {
    if (parentId === null) return;
    const controller = new AbortController();
    load(parentId, controller.signal)
      .then((options) => setResult({ key: parentId, options, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: parentId, options: [], error: true });
      });
    return () => controller.abort();
  }, [parentId, load]);

  if (parentId === null) return { options: [], loading: false, error: false };
  if (result?.key !== parentId) return { options: [], loading: true, error: false };
  return { options: result.options, loading: false, error: result.error };
}

const loadCountries = (_: string, signal: AbortSignal) => getCountries(signal);
const loadStates = (countryId: string, signal: AbortSignal) => getStates(countryId, signal);
const loadCities = (stateId: string, signal: AbortSignal) => getCities(stateId, signal);

function LocationSelect({
  id,
  label,
  placeholder,
  value,
  list,
  disabled,
  error,
  onChange,
}: {
  id: keyof FormValues;
  label: string;
  placeholder: string;
  value: string;
  list: LocationList;
  disabled?: boolean;
  error?: string | undefined;
  onChange: (value: string) => void;
}) {
  const loadError = list.error ? `Couldn't load ${label.toLowerCase()} options.` : undefined;
  return (
    <AuthField required label={label} htmlFor={id} error={error ?? loadError}>
      <select
        id={id}
        name={id}
        value={value}
        disabled={disabled || list.loading}
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-critical" : "border-input"
        } ${value ? "" : "text-muted-foreground"}`}
      >
        <option value="">{list.loading ? "Loading…" : placeholder}</option>
        {list.options.map((option) => (
          <option key={option._id} value={option._id}>
            {option.name}
          </option>
        ))}
      </select>
    </AuthField>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({
    accountType: "business",
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirm_password: "",
    business_name: "",
    website_url: "",
    business_address: "",
    country_id: "",
    state_id: "",
    city_id: "",
    zip_code: "",
    acceptedTerms: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const countries = useLocationList("", loadCountries);
  const states = useLocationList(values.country_id || null, loadStates);
  const cities = useLocationList(values.state_id || null, loadCities);

  const isAgency = values.accountType === "agency";

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function selectCountry(countryId: string) {
    setValues((prev) => ({ ...prev, country_id: countryId, state_id: "", city_id: "" }));
    setErrors((prev) => ({ ...prev, country_id: undefined, state_id: undefined, city_id: undefined }));
  }

  function selectState(stateId: string) {
    setValues((prev) => ({ ...prev, state_id: stateId, city_id: "" }));
    setErrors((prev) => ({ ...prev, state_id: undefined, city_id: undefined }));
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

    const data = result.data;
    const payload: SignupRequest = {
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      user_type: data.accountType === "agency" ? "AGENCY" : "BUSINESS",
      password: data.password,
      confirm_password: data.confirm_password,
      country_id: data.country_id,
      state_id: data.state_id,
      city_id: data.city_id,
      business_address: data.business_address,
      website_url: data.website_url,
      business_name: data.business_name,
      zip_code: data.zip_code,
    };

    setSubmitting(true);
    setFormError(null);
    try {
      await signup(payload);
      await navigate(`/verify-otp?email=${encodeURIComponent(payload.email)}&type=EMAIL_VERIFICATION`);
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

        <div className="grid gap-4 sm:grid-cols-2">
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

          <AuthField required label="Mobile number" htmlFor="mobile" error={errors.mobile}>
            <AuthInput
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="7718348409"
              value={values.mobile}
              invalid={Boolean(errors.mobile)}
              onChange={(e) => update("mobile", e.target.value)}
            />
          </AuthField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

          <AuthField required label="Confirm password" htmlFor="confirm_password" error={errors.confirm_password}>
            <AuthPasswordInput
              id="confirm_password"
              name="confirm_password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={values.confirm_password}
              invalid={Boolean(errors.confirm_password)}
              onChange={(e) => update("confirm_password", e.target.value)}
            />
          </AuthField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            required
            label={isAgency ? "Agency name" : "Business name"}
            htmlFor="business_name"
            error={errors.business_name}
          >
            <AuthInput
              id="business_name"
              name="business_name"
              autoComplete="organization"
              placeholder={isAgency ? "Northbound Digital" : "Riverside Dental"}
              value={values.business_name}
              invalid={Boolean(errors.business_name)}
              onChange={(e) => update("business_name", e.target.value)}
            />
          </AuthField>

          <AuthField required label="Website" htmlFor="website_url" error={errors.website_url}>
            <AuthInput
              id="website_url"
              name="website_url"
              type="url"
              autoComplete="url"
              placeholder="https://example.com"
              value={values.website_url}
              invalid={Boolean(errors.website_url)}
              onChange={(e) => update("website_url", e.target.value)}
            />
          </AuthField>
        </div>

        <AuthField required label="Business address" htmlFor="business_address" error={errors.business_address}>
          <AuthInput
            id="business_address"
            name="business_address"
            autoComplete="street-address"
            placeholder="Street, area"
            value={values.business_address}
            invalid={Boolean(errors.business_address)}
            onChange={(e) => update("business_address", e.target.value)}
          />
        </AuthField>

        <div className="grid gap-4 sm:grid-cols-2">
          <LocationSelect
            id="country_id"
            label="Country"
            placeholder="Select a country"
            value={values.country_id}
            list={countries}
            error={errors.country_id}
            onChange={selectCountry}
          />
          <LocationSelect
            id="state_id"
            label="State"
            placeholder={values.country_id ? "Select a state" : "Select a country first"}
            value={values.state_id}
            list={states}
            disabled={!values.country_id}
            error={errors.state_id}
            onChange={selectState}
          />
          <LocationSelect
            id="city_id"
            label="City"
            placeholder={values.state_id ? "Select a city" : "Select a state first"}
            value={values.city_id}
            list={cities}
            disabled={!values.state_id}
            error={errors.city_id}
            onChange={(value) => update("city_id", value)}
          />
          <AuthField required label="ZIP / postal code" htmlFor="zip_code" error={errors.zip_code}>
            <AuthInput
              id="zip_code"
              name="zip_code"
              autoComplete="postal-code"
              placeholder="125486"
              value={values.zip_code}
              invalid={Boolean(errors.zip_code)}
              onChange={(e) => update("zip_code", e.target.value)}
            />
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
              <span aria-hidden className="ml-0.5 text-critical">
                *
              </span>
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
