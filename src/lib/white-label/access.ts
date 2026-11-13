import { useAccess } from "@/hooks/use-access";
import { useWorkspace } from "@/lib/mypageseo/workspace";

export type WhiteLabelAccess = {
  /** False until the workspace knows the account type and role, so nobody is sent somewhere on a guess. */
  ready: boolean;
  /** Agency owners and members work in White Label (brand, client links, PDF reports). */
  canWhiteLabel: boolean;
  /** Only the agency's owner changes the brand; members see it read-only. */
  canEditBrand: boolean;
  /** Creating links, reports and emails (not a client user). */
  canEdit: boolean;
  /** Where this user's reports live: White Label for agency staff, Reports for everyone else. */
  home: "/white-label" | "/reports";
  homeLabel: "White Label" | "Reports";
  /** The PDF reports list itself. */
  reportsPath: "/white-label#reports" | "/reports";
};

/**
 * Who gets White Label and who gets Reports. Agency owners and members (`clients.view`) get
 * White Label; business accounts and agency client users get Reports (PDF reports and monthly
 * emails only). The backend stays authoritative.
 */
export function useWhiteLabelAccess(): WhiteLabelAccess {
  const { status } = useWorkspace();
  const access = useAccess();
  const canWhiteLabel = access.accountType === "agency" && access.can("clients.view");
  return {
    ready: status !== "loading",
    canWhiteLabel,
    canEditBrand: canWhiteLabel && access.can("white_label.manage"),
    canEdit: access.can("workspace.edit"),
    home: canWhiteLabel ? "/white-label" : "/reports",
    homeLabel: canWhiteLabel ? "White Label" : "Reports",
    reportsPath: canWhiteLabel ? "/white-label#reports" : "/reports",
  };
}
