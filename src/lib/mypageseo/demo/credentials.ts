/**
 * Demo sign-in credentials (frontend only).
 *
 * The authentication backend is not connected to this frontend. These fixed
 * credentials let the onboarding and product flows be walked end to end using
 * the centralized demo data. Delete this file once real sign-in is wired up.
 */

export type DemoCredential = {
  email: string;
  password: string;
  accountType: "business" | "agency";
  organizationName: string;
  country: string;
  label: string;
  /** Where signing in lands: fresh setup, or an already-configured workspace. */
  destination: "onboarding" | "dashboard";
};

export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    email: "business@mypageseo.demo",
    password: "Demo1234",
    accountType: "business",
    organizationName: "Riverside Dental Group",
    country: "US",
    label: "Business — new account, starts onboarding",
    destination: "onboarding",
  },
  {
    email: "agency@mypageseo.demo",
    password: "Demo1234",
    accountType: "agency",
    organizationName: "Northbound Digital",
    country: "US",
    label: "Agency — new account, starts onboarding",
    destination: "onboarding",
  },
  {
    email: "demo@mypageseo.demo",
    password: "Demo1234",
    accountType: "business",
    organizationName: "Riverside Dental Group",
    country: "US",
    label: "Business — set up already, goes to the dashboard",
    destination: "dashboard",
  },
];

export function matchDemoCredential(email: string, password: string): DemoCredential | null {
  const normalized = email.trim().toLowerCase();
  return (
    DEMO_CREDENTIALS.find(
      (entry) => entry.email === normalized && entry.password === password,
    ) ?? null
  );
}
