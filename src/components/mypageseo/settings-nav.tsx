import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/mypageseo/access";
import type { Permission } from "@/lib/mypageseo/access";

type SettingsSection =
  | "general"
  | "profile"
  | "team"
  | "integrations"
  | "billing"
  | "notifications"
  | "white-label";

type SettingsNavProps = {
  /** Route id of the active settings screen. */
  active: SettingsSection;
  isAgency: boolean;
  className?: string;
};

const linkClass =
  "whitespace-nowrap border-b-2 px-1 pb-2.5 text-sm font-medium transition-colors";

type SettingsLink = {
  id: SettingsSection;
  label: string;
  to: string;
  /** Hidden when the signed-in user does not hold this permission. */
  permission?: Permission;
  agencyOnly?: boolean;
};

const SETTINGS_LINKS: SettingsLink[] = [
  { id: "general", label: "General", to: "/settings", permission: "settings.manage" },
  { id: "profile", label: "Profile", to: "/settings/profile" },
  { id: "team", label: "Team", to: "/settings/team", permission: "team.view" },
  {
    id: "integrations",
    label: "Integrations",
    to: "/settings/integrations",
    permission: "integrations.manage",
  },
  { id: "billing", label: "Billing", to: "/settings/billing", permission: "billing.view" },
  { id: "notifications", label: "Notifications", to: "/settings/notifications" },
  {
    id: "white-label",
    label: "White-label",
    to: "/settings/white-label",
    permission: "white_label.manage",
    agencyOnly: true,
  },
];

/**
 * Shared settings navigation. Sections the account cannot open are not shown,
 * so nobody is sent to a screen they would be refused.
 */
export function SettingsNav({ active, isAgency, className }: SettingsNavProps) {
  const access = useAccess();
  const links = SETTINGS_LINKS.filter((link) => {
    if (link.agencyOnly && !isAgency) return false;
    return link.permission ? access.can(link.permission) : true;
  });

  return (
    <nav
      aria-label="Settings sections"
      className={cn("mb-6 overflow-x-auto border-b border-border", className)}
    >
      <ul className="flex min-w-max items-center gap-5">
        {links.map((link) => (
          <li key={link.id}>
            <Link
              to={link.to}
              className={cn(
                linkClass,
                active === link.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
