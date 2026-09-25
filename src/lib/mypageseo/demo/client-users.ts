/**
 * Demo dataset for agency client user access.
 *
 * The client-user contract does not define a role catalog of its own (roles
 * are opaque ids resolved against whatever list is returned alongside the
 * users). Since the client-users screen renders a role/"access level"
 * column, this demo layer defines a minimal, clearly-documented role set
 * (Owner, Admin, Editor, Viewer) purely for demo presentation. Replace this
 * file (and the role list) once the agency account-management backend
 * supplies real roles.
 */
import { demoDate, pickInt, seedFrom } from "./demo-mode";
import { DEMO_CLIENTS } from "./entities";
import type { ClientUser, ClientUserRole, ClientUserStatus } from "../client-users";

export const DEMO_CLIENT_USER_ROLES: ClientUserRole[] = [
  { id: "owner", label: "Owner", description: "Full access to this client's workspace, including billing and access management." },
  { id: "admin", label: "Admin", description: "Manage locations, reports and users for this client." },
  { id: "editor", label: "Editor", description: "Manage rankings, GBP, citations and reports for this client." },
  { id: "viewer", label: "Viewer", description: "Read-only access to dashboards and reports." },
];

type DemoUserSeed = {
  name: string;
  email: string;
  roleId: string;
  status: ClientUserStatus;
  daysAgoActive: number | null;
};

const CLIENT_USER_SEEDS: Record<string, DemoUserSeed[]> = {
  cl_riverside: [
    { name: "Dana Whitfield", email: "dana.whitfield@riversidedental.com", roleId: "owner", status: "active", daysAgoActive: 1 },
    { name: "Marcus Ibe", email: "marcus.ibe@riversidedental.com", roleId: "admin", status: "active", daysAgoActive: 2 },
    { name: "Priya Nair", email: "priya.nair@riversidedental.com", roleId: "editor", status: "active", daysAgoActive: 5 },
    { name: "Tom Radley", email: "tom.radley@riversidedental.com", roleId: "viewer", status: "invited", daysAgoActive: null },
  ],
  cl_hearth: [
    { name: "Josie Calder", email: "josie.calder@hearthandoak.com", roleId: "owner", status: "active", daysAgoActive: 0 },
    { name: "Rafael Ortiz", email: "rafael.ortiz@hearthandoak.com", roleId: "editor", status: "active", daysAgoActive: 3 },
    { name: "Ellen Marsh", email: "ellen.marsh@hearthandoak.com", roleId: "viewer", status: "pending", daysAgoActive: null },
  ],
  cl_summit: [
    { name: "Greg Alders", email: "greg.alders@summitautocare.com", roleId: "owner", status: "active", daysAgoActive: 4 },
    { name: "Nina Sørensen", email: "nina.sorensen@summitautocare.com", roleId: "admin", status: "active", daysAgoActive: 1 },
    { name: "Beau Kimura", email: "beau.kimura@summitautocare.com", roleId: "viewer", status: "suspended", daysAgoActive: 61 },
  ],
  cl_lumen: [
    { name: "Renee Castillo", email: "renee.castillo@lumenfamilylaw.com", roleId: "owner", status: "active", daysAgoActive: 7 },
    { name: "Adam Fitch", email: "adam.fitch@lumenfamilylaw.com", roleId: "editor", status: "invited", daysAgoActive: null },
  ],
};

export function demoClientUsers(clientId: string): ClientUser[] {
  const seeds = CLIENT_USER_SEEDS[clientId] ?? [];
  return seeds.map((seed, index) => ({
    id: `cu_${clientId}_${index + 1}`,
    name: seed.name,
    email: seed.email,
    roleId: seed.roleId,
    status: seed.status,
    lastActivity: seed.daysAgoActive === null ? null : demoDate(seed.daysAgoActive),
    locationIds: null,
  }));
}

/** Deterministic filler for clients not covered by explicit seeds. */
export function demoClientUsersFallback(clientId: string): ClientUser[] {
  const client = DEMO_CLIENTS.find((c) => c.id === clientId);
  if (!client) return [];
  const seed = seedFrom(clientId, "fallback-user");
  return [
    {
      id: `cu_${clientId}_1`,
      name: `${client.name} Owner`,
      email: `owner@${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
      roleId: "owner",
      status: "active",
      lastActivity: demoDate(pickInt(seed, 0, 10)),
      locationIds: null,
    },
  ];
}
