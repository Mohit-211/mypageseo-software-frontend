# Note for the customer-app Claude: agency employees limited to their clients (Phase 21, 2026-10-12)

Paste this into the customer frontend session (app.mypageseo.com). Shapes: the backend repo's `docs/API.md` "Members limited to clients (Phase 21)"; flow: `docs/FLOWS.md` §5.

---

**What's new:** an agency owner can now limit an employee (`member`) to the clients that employee handles. A limited ("restricted") member keeps a member's write access (tracking, refresh, posts, reviews, reports, schedules), but only for the locations of its clients. Everything else is invisible to it: another client's location gives a 404, the same as for a client_user. A member without clients works on every client, as before.

**Citations don't change:** they stay managed by the MyPageSEO team and read-only for every customer role. A restricted member reads citations and creates Citation Reports for its clients only. Don't add citation editing.

## 1. Team page (owner)

- **Invite:**
  - Add an "Access" choice to the invite form: **All clients** (default) or **Only these clients** (a multi-select from `GET /clients`).
  - Send `POST /organization/invitations { email, role: "member", client_ids: [...] }`. Omit `client_ids` (or send `[]`) for "All clients".
  - Show it on agency organizations only. A business gets 403 `agency_only`.
- **Change access:** `PATCH /organization/members/:userId { role: "member", client_ids: [...] }`. `[]` gives access to all clients again. The answer has `restricted`.
- **Members table:** rows carry `restricted` and `client_ids`. Show "All clients" or the client names, plus an Edit action.
- **Deleting a client** takes it off every employee's list. An employee whose last client is gone keeps the limit and sees nothing until the owner gives it a client. On the members table, show a restricted member with no clients as "No clients assigned" so the owner notices.

## 2. The limited employee's app

**How to tell:** `GET /organization` → `{ role: "member", restricted: true, client_ids }` (a client_user is also `restricted: true`, as before). Branch on role + restricted:

| Control | Restricted member |
|---|---|
| "New client", "Delete client" | hide (403 `assigned_clients_only`) |
| Edit client name / contact | keep (its own clients) |
| "Unassign" a location from a client, client = "None" in location settings | hide (400 `client_required`) |
| Client picker on add location / Bind / location settings | **required**, listing only its `client_ids` |
| Everything else a member can do | keep |

Lists, dashboards, reports, schedules and the posts calendar are already filtered by the backend; there is nothing to filter on the client side.

**New reasons:**
- **400 `client_required`:** add location / Bind without a client, or setting the client to none. Ask the user to pick one of their clients.
- **403 `client_not_assigned`:** a client that isn't theirs (shouldn't happen if the picker is limited).
- **403 `assigned_clients_only`:** create or delete a client.

**Known:** adding a place that already exists for another client gives 409 `duplicate_place` with a `location_id` the employee can't open. Show "This business is already in your organization (managed by another team member)" and don't link to it. Places search may also mark such results `already_added`.

## How to report back

One line each for sections 1 and 2: OK / changed (what) / question. If a design needs something that isn't here, ask Mohit to have the backend Claude add it.
