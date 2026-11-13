import type { ComponentProps } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Bell, Building, CreditCard, PlugZap, UserRound, Users, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/shared/data-display";
import { PageSkeleton } from "@/components/layout/shared/feedback/states";
import { AccessDeniedPanel } from "@/components/mypageseo/access";
import { SettingsNav } from "@/components/settings/settings-nav";
import { useAccess } from "@/hooks/use-access";
import { accessDeniedReason, type Permission } from "@/lib/mypageseo/access";
import { useWorkspace } from "@/lib/mypageseo/workspace";

type SectionId = ComponentProps<typeof SettingsNav>["active"];

type Section = {
  id: SectionId;
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Who may open it; everyone when absent. */
  permission?: Permission;
};

const SECTIONS: Section[] = [
  { id: "general", path: "/settings", title: "Organization", description: "Your organization's name and country, and what it uses.", icon: Building, permission: "settings.manage" },
  { id: "profile", path: "/settings/profile", title: "Profile", description: "Your name, phone, sign-in email and password.", icon: UserRound },
  { id: "team", path: "/settings/team", title: "Team", description: "Who can use this organization, and what each person can do.", icon: Users, permission: "team.view" },
  {
    id: "integrations",
    path: "/settings/integrations",
    title: "Integrations",
    description: "The Google accounts that manage your Business Profiles.",
    icon: PlugZap,
    permission: "integrations.manage",
  },
  { id: "billing", path: "/settings/billing", title: "Billing", description: "Your plan, tokens and invoices.", icon: CreditCard, permission: "billing.view" },
  { id: "notifications", path: "/settings/notifications", title: "Notifications", description: "Which MyPageSEO updates and alerts reach you.", icon: Bell },
];

/**
 * Every settings screen: one header (the section's name under a "Settings" eyebrow), the settings
 * tabs, then the section. The layout decides access, so a section someone can't open shows why in
 * place (the tabs never link to it) and the organization screen sends non-owners to their profile.
 */
function SettingsLayout() {
  const { pathname } = useLocation();
  const workspace = useWorkspace();
  const access = useAccess();
  const path = pathname.replace(/\/+$/, "") || "/settings";
  const section = SECTIONS.find((entry) => entry.path === path) ?? SECTIONS[0]!;

  // Wait for the real role before deciding, so an owner is never sent away on a guess.
  if (workspace.status === "loading") return <PageSkeleton metrics={0} rows={4} columns={2} />;
  // Members and client users land on their own profile instead of "access denied".
  if (section.id === "general" && !access.can("settings.manage")) {
    return (
      <>
        <Navigate to="/settings/profile" replace />
        <PageSkeleton metrics={0} rows={4} columns={2} />
      </>
    );
  }
  const allowed = !section.permission || access.can(section.permission);

  return (
    <>
      <PageHeader
        icon={section.icon}
        tone="settings"
        eyebrow={<span className="font-semibold uppercase tracking-wider text-muted-foreground">Settings</span>}
        title={section.title}
        description={section.description}
      >
        <SettingsNav active={section.id} isAgency={workspace.organization?.accountType === "agency"} className="mb-0 w-full" />
      </PageHeader>
      {allowed ? <Outlet /> : <AccessDeniedPanel description={accessDeniedReason(section.permission!, access.accountType)} />}
    </>
  );
}

export default SettingsLayout;
