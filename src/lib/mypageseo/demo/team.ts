/**
 * Demo dataset for organization team management.
 *
 * The team contract keeps roles as opaque ids resolved against the role list
 * returned with the same payload. This demo layer defines a small, clearly
 * documented organization role set purely so the Team screen can be reviewed.
 * Replace this file once the account-management backend supplies real roles,
 * members and invitations.
 */
import { demoDate } from "./demo-mode";
import { DEMO_ORGANIZATIONS } from "./entities";
import type { TeamCapabilities, TeamMember, TeamRole } from "../team";

export const DEMO_TEAM_ROLES: TeamRole[] = [
  {
    id: "owner",
    label: "Owner",
    description: "Full access to the organization, including billing, branding and team management.",
    canManageTeam: true,
  },
  {
    id: "admin",
    label: "Administrator",
    description: "Manage locations, reports, integrations and team access.",
    canManageTeam: true,
  },
  {
    id: "client_manager",
    label: "Client manager",
    description: "Full access to assigned clients and their locations only.",
    canManageTeam: false,
  },
  {
    id: "specialist",
    label: "SEO specialist",
    description: "Work on rankings, Google Business Profile, citations and reports.",
    canManageTeam: false,
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Read-only access to dashboards and reports.",
    canManageTeam: false,
  },
];

type TeamSeed = {
  name: string;
  email: string;
  roleId: string;
  status: TeamMember["status"];
  daysAgoActive: number | null;
  invitedDaysAgo: number | null;
  clientIds: string[] | null;
  isCurrentUser?: boolean;
};

const AGENCY_TEAM: TeamSeed[] = [
  {
    name: "Alina Petrov",
    email: "alina.petrov@northbounddigital.com",
    roleId: "owner",
    status: "active",
    daysAgoActive: 0,
    invitedDaysAgo: null,
    clientIds: null,
    isCurrentUser: true,
  },
  {
    name: "Devon Wallace",
    email: "devon.wallace@northbounddigital.com",
    roleId: "admin",
    status: "active",
    daysAgoActive: 1,
    invitedDaysAgo: null,
    clientIds: null,
  },
  {
    name: "Maya Rojas",
    email: "maya.rojas@northbounddigital.com",
    roleId: "client_manager",
    status: "active",
    daysAgoActive: 1,
    invitedDaysAgo: null,
    clientIds: ["cl_riverside", "cl_lumen"],
  },
  {
    name: "Ben Okafor",
    email: "ben.okafor@northbounddigital.com",
    roleId: "client_manager",
    status: "active",
    daysAgoActive: 3,
    invitedDaysAgo: null,
    clientIds: ["cl_hearth", "cl_summit"],
  },
  {
    name: "Sara Lindqvist",
    email: "sara.lindqvist@northbounddigital.com",
    roleId: "specialist",
    status: "active",
    daysAgoActive: 2,
    invitedDaysAgo: null,
    clientIds: ["cl_riverside"],
  },
  {
    name: "Tobias Grant",
    email: "tobias.grant@northbounddigital.com",
    roleId: "specialist",
    status: "invited",
    daysAgoActive: null,
    invitedDaysAgo: 4,
    clientIds: ["cl_summit"],
  },
  {
    name: "Hannah Beck",
    email: "hannah.beck@northbounddigital.com",
    roleId: "viewer",
    status: "invited",
    daysAgoActive: null,
    invitedDaysAgo: 11,
    clientIds: ["cl_hearth"],
  },
  {
    name: "Chris Malone",
    email: "chris.malone@northbounddigital.com",
    roleId: "specialist",
    status: "deactivated",
    daysAgoActive: 74,
    invitedDaysAgo: null,
    clientIds: ["cl_lumen"],
  },
];

const BUSINESS_TEAM: TeamSeed[] = [
  {
    name: "Dana Whitfield",
    email: "dana.whitfield@riversidedental.com",
    roleId: "owner",
    status: "active",
    daysAgoActive: 0,
    invitedDaysAgo: null,
    clientIds: null,
    isCurrentUser: true,
  },
  {
    name: "Marcus Ibe",
    email: "marcus.ibe@riversidedental.com",
    roleId: "admin",
    status: "active",
    daysAgoActive: 2,
    invitedDaysAgo: null,
    clientIds: null,
  },
  {
    name: "Priya Nair",
    email: "priya.nair@riversidedental.com",
    roleId: "specialist",
    status: "active",
    daysAgoActive: 6,
    invitedDaysAgo: null,
    clientIds: null,
  },
  {
    name: "Tom Radley",
    email: "tom.radley@riversidedental.com",
    roleId: "viewer",
    status: "invited",
    daysAgoActive: null,
    invitedDaysAgo: 5,
    clientIds: null,
  },
];

export function demoTeamCapabilities(accountType: "business" | "agency"): TeamCapabilities {
  return {
    canInvite: true,
    canResendInvite: true,
    canRevokeInvite: true,
    canEditAccess: true,
    // Client scope only exists in agency organizations.
    canAssignClients: accountType === "agency",
    canDeactivate: true,
    canRemove: true,
  };
}

export function demoTeam(organizationId: string, accountType: "business" | "agency"): TeamMember[] {
  const seeds =
    accountType === "agency" || organizationId === DEMO_ORGANIZATIONS.agency.id ? AGENCY_TEAM : BUSINESS_TEAM;
  return seeds.map((seed, index) => ({
    id: `tm_${organizationId}_${index + 1}`,
    name: seed.name,
    email: seed.email,
    roleId: seed.roleId,
    status: seed.status,
    lastActivity: seed.daysAgoActive === null ? null : demoDate(seed.daysAgoActive),
    invitedAt: seed.invitedDaysAgo === null ? null : demoDate(seed.invitedDaysAgo),
    clientIds: accountType === "agency" ? seed.clientIds : null,
    isCurrentUser: seed.isCurrentUser === true,
  }));
}
