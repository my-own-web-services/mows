# USER_GROUPS — Lifecycle, Visibility, and Join Semantics

IDEA.md §UserGroups:

> Users can be invited to groups or join public groups, they may request to
> be added to restricted user groups that are listed but not joinable
> directly.

This document formalises that into two orthogonal axes — *visibility* and
*join policy* — with explicit lifecycle and audit.

## 1. Two orthogonal axes

`user_groups.visibility` answers: *who can see this group exists?*

| Value                  | Meaning                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| `Private`              | Only group owner, admins, and current members can see the group        |
| `ListedRestricted`     | Every server member can see the group in directories, but cannot join  |
| `Public`               | Everyone (including non-server-members?) can see the group exists      |

`user_groups.join_policy` answers: *who can become a member?*

| Value             | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `InviteOnly`      | Owner / admin adds members directly. Users cannot apply.           |
| `RequestToJoin`   | Users may request; owner / admin approves                          |
| `OpenJoin`        | Any server member may join themselves with no approval             |

The full IDEA.md sentence expands to three useful combinations:

1. **Invite-only private group** (`Private` × `InviteOnly`) — internal teams.
2. **Listed restricted group** (`ListedRestricted` × `RequestToJoin`) — the
   "listed but not joinable directly" case from IDEA.md.
3. **Public open group** (`Public` × `OpenJoin`) — a community channel.

All nine combinations are *legal*; the engine does not refuse the unusual
ones (e.g. `Private` × `OpenJoin` is a private group anyone can join *if*
they're invited to see it). The owner is allowed to be creative.

## 2. The lifecycle of a membership

```
[non-member]
   │  user_requests_to_join()        ┌──── owner_approves() ──┐
   │                ▼                ▼                       │
   │           [requested] ── owner_rejects() ──> [non-member]
   │                                                          │
   │  owner_invites()  ──────────────────────────►   [invited]│
   │                                                  │       │
   │                                                  │ user_accepts()
   │                                                  ▼       │
   │           ┌──────────────────────────────────────┴───┐   │
   └───────────►                  [member]                 ◄───┘
                       │
                       │ owner_removes()  /  user_leaves()
                       ▼
                  [non-member]
```

Implementation:

- `user_user_group_members` (existing) = the active set.
- `user_user_group_join_requests` (NEW, see DATA_MODEL.md §2.3) = pending
  requests from users to join `RequestToJoin` groups.
- `user_user_group_invitations` (NEW) = pending invites from owners to
  users for `InviteOnly` and `RequestToJoin` groups.

```sql
CREATE TABLE user_user_group_invitations (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_group_id  UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    invited_time   TIMESTAMP NOT NULL,
    invited_by     UUID NOT NULL REFERENCES users(id),
    message        TEXT NULL,
    PRIMARY KEY (user_id, user_group_id)
);
```

A user accepting an invitation moves the row from
`user_user_group_invitations` to `user_user_group_members` in a single
transaction. Same for owner approval of a join request.

## 3. Who controls a group?

Today filez's `user_groups` has only `owner_id`. That's enough for v1.

A group has exactly one owner. The owner may also be a member (and almost
always is). The owner can:

- update group metadata (name, description, visibility, join_policy)
- invite members
- approve/reject join requests
- remove members
- transfer ownership (creates a new owner; the old owner becomes a
  regular member unless they leave)
- delete the group

For larger groups we'll want group *admins* (multiple). Out of scope for
v1; OPEN_QUESTIONS.md tracks this.

## 4. How groups interact with access policies

This is already in place via `AccessPolicySubjectType::UserGroup`. Every
policy whose `subject_type = UserGroup` and `subject_id = G` applies to the
current members of `G` at evaluation time. Membership change is
immediately reflected on the next check; no policy rewrite needed.

Two consequences:

1. **Removing a user from a group revokes their group-mediated access
   immediately.** Good (this is the expected behaviour).
2. **Deleting a group cascades policies via FK** (we add `ON DELETE
   CASCADE` to `access_policies.subject_id` when subject_type = UserGroup).
   Implementation note: Postgres FKs can't be conditional on a column, so
   we model this with a per-group trigger that deletes matching
   `access_policies` when a `user_groups` row is deleted.

## 5. Public and ServerMember as pseudo-groups

`subject_type = ServerMember` and `subject_type = Public` are conceptually
"everyone who has logged in to this server" and "everyone, with or without
a login", respectively. They are not rows in `user_groups`. The policy
table uses the sentinel nil-UUID `subject_id` for both. The check engine
treats them as virtual groups that the requesting user / lack-of-user is
trivially a member of.

The UI surfaces them as the two top-level options in any "share with…"
picker:

- Share with one or more *users*
- Share with one or more *user groups*
- Share with *all members of this server*
- Share with *everyone, including anonymous*

This is the model the IDEA.md §AccessPolicies §Shared paragraph already
sketches; nothing new conceptually.

## 6. Group directory and discovery endpoints

| Endpoint                                                 | Returns                                            | Visibility filter                          |
| -------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `GET /user-groups?filter=owned`                          | Groups I own                                       | always visible to owner                    |
| `GET /user-groups?filter=member`                         | Groups I am a member of                            | always visible to member                   |
| `GET /user-groups?filter=invited`                        | Groups I am invited to                             | always visible to invitee                  |
| `GET /user-groups?filter=requested`                      | Groups I have a pending request for               | always visible                              |
| `GET /user-groups?filter=public`                         | All `Public` groups                                | logged in OR anon (Public visibility)      |
| `GET /user-groups?filter=server-listed`                  | All `ListedRestricted` and `Public` groups         | requires login                             |
| `POST /user-groups/{id}/join`                            | join if `OpenJoin`; create request if `RequestToJoin` | refuses for `InviteOnly`                |
| `POST /user-groups/{id}/leave`                           | leave                                              |                                            |
| `POST /user-groups/{id}/invitations` (owner)             | invite a user                                      | owner only                                 |
| `POST /user-groups/{id}/invitations/{user_id}/accept`    | accept invitation                                  | invitee only                               |
| `POST /user-groups/{id}/requests/{user_id}/approve`      | approve a join request                             | owner only                                 |

Each endpoint is gated by a corresponding `AccessPolicyAction`:
`UserGroupsList`, `UserGroupsListUsers` (the implementation name for
listing members of a group; an earlier draft called this
`UserGroupsListMembers` — same semantics, kept as `ListUsers` to
mirror `UsersList` elsewhere in the enum), `UserGroupsInvite`,
`UserGroupsRespondToInvite`, `UserGroupsRequestJoin`, `UserGroupsApprove`,
`UserGroupsLeave`, `UserGroupsDelete`. The default policies (created when
a group is created) grant the owner everything and grant members
`UserGroupsList`/`UserGroupsListUsers`. Default-policy bootstrap is
deferred — see ROADMAP.md Phase 4 follow-up. Anything beyond the
defaults is configurable.

Implementation note: endpoint paths in the spec table above use the
shorthand `/user-groups/{id}/…`; the actual API mounts these under
`/api/user_groups/{id}/…` (underscored, mirroring the table name
`user_user_group_*`). The `requests/` segment in the spec is
`join_requests/` in the implementation for the same reason.

## 7. Edge cases the implementation must handle

1. **Demoting an owner.** Cannot happen — the only way out is to transfer
   ownership first. Validation in the HTTP handler.
2. **Deleting a group with active shares.** All `access_policies` rows
   with this group as subject are dropped (§4). Users who only had
   group-mediated access lose it on next check. The deletion is logged
   in the audit table with the affected policy ids so an admin can
   restore the shape if it was a mistake.
3. **A user requests to join, then the group flips to `OpenJoin`.** The
   request becomes redundant. A background tick or a join-policy-change
   trigger automatically converts pending requests to memberships and
   notifies the user. Alternative: do nothing; the user can still
   manually click "join". Pick the explicit trigger — better UX, no
   ambiguity.
4. **A user is invited, then the group flips to `Public`/`OpenJoin`.**
   The invitation is irrelevant but harmless. Leave it; if the user
   acts on it we accept; if they ignore it the invitation expires.
5. **The owner deletes their own account.** Group ownership moves to a
   system-defined `nobody` user, and a notification is emitted to
   server admins; they can transfer the group manually. We do not
   silently delete owner-less groups.
6. **A group's policy revocation race.** A user is removed from a group
   *while* a request that depends on the membership is being evaluated.
   The request sees the snapshot it started with — no engine-side
   coordination. Acceptable (POLICY_SEMANTICS.md §7).

## 8. Test plan for groups

- Visibility matrix: 3 × 3 combinations × 4 viewer types (owner, member,
  non-member-server, anon) — assert the directory listing for each cell.
- Lifecycle: invite → accept, invite → reject, request → approve,
  request → reject, request → policy-flip → auto-promote, owner removes
  member, user leaves.
- Cascade: delete group ⇒ all subject-targeted policies gone, all
  invitations gone, all join requests gone.
- Ownership transfer: previous owner becomes a member only if they
  already were one; otherwise they are removed from the group as part of
  transfer.
- ServerMember vs Public: a logged-out request never matches a
  `ServerMember` policy; a logged-in request matches both.

## 9. UI affordances

Not in scope here (this is auth, not UI), but flagging for the manager-UI
team:

- Search-and-pick combobox for `UserGroup` shares: the autocomplete must
  filter to groups the *sharer* may discover (owned + listed-restricted +
  public + groups they're a member of).
- A "you have N pending invitations / M pending join requests" indicator
  in the global nav.
- Per-group settings panel: visibility, join_policy, members table with
  per-row action menu (remove, transfer ownership).
