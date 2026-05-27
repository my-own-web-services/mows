# Phase 4 Multi-Review Findings

10-perspective review of the Phase 4 closing batch
(USER_GROUPS.md §6 + §7.2/§7.3/§7.5 — 13 new endpoints, 2 new model
files, 2 new migrations, plus `delete_user` extension).

Diff scope: `git diff $(git merge-base HEAD main)..HEAD` for the
`apis/cloud/filez/server/src/{http_api,models}/user_groups/**`,
`models/user_user_group_{invitations,join_requests}/**`,
`http_api/users/delete.rs`, `models/users/mod.rs`, migrations
00008 + 00010 paths.

Status markers: `❌` = open, `✅` = resolved, `⁉️` = not a real issue.

---

## Summary

| Perspective   | Critical | Major | Minor |
| ------------- | -------- | ----- | ----- |
| Security      | 0        | 0     | 0 (review found no exploitable issues) |
| Technology    | 1        | 5     | 9 |
| DevOps        | 1        | 3     | 4 |
| Architecture  | 1        | 4     | 6 |
| QA            | 1        | 7     | 5 |
| Fine Taste    | 2        | 1     | 7 |
| Documentation | 1        | 5     | 6 |
| Repository    | 1        | 3     | 7 |
| Slop          | 0        | 6     | 6 |
| Future Proof  | 2        | 4     | 4 |

After deduplication: **3 critical**, **~10 major**, **~15 minor** distinct issues.

---

## Critical

- **CRIT-1** ❌ — `tracing::info!` in `users/delete.rs:91-99` passes
  `transferred_groups` twice: once as a structured field and once as
  a format-string arg. This is a real bug — the macro will format
  the message with the value but log aggregators will see a
  duplicated field. (TASTE-1, DEVOPS-2)
  - **Fix:** drop the trailing positional `transferred_groups`; keep
    only the structured field + a static message.

- **CRIT-2** ❌ — `user_groups/delete.rs:75` constructs
  `ApiResponseStatus::Success` (unit form) but the rest of the
  codebase uses `ApiResponseStatus::Success {}` (struct form). This
  was likely an oversight when extending the handler — the change
  compiles because both forms parse, but it's a style inconsistency
  the codebase has been treating as load-bearing. (TASTE-2)
  - **Fix:** `ApiResponseStatus::Success {}`.

- **CRIT-3** ❌ — `user_groups/delete.rs` calls
  `AccessPolicy::delete_all_by_subject` and `UserGroup::delete_one`
  in sequence WITHOUT wrapping them in a transaction. If the second
  call fails (FK cascade race, conn drop), the group lives on with
  zero subject-targeted policies — silent permission downgrade for
  everyone who had access via group-mediated policies. (QA-7)
  - **Fix:** wrap both writes in a `conn.transaction(...)` block.
    Reuse the diesel-async `scope_boxed()` pattern already used in
    `approve_in_transaction` / `accept_in_transaction`.

---

## Major

- **MAJ-1** ❌ — `candidate_ids_for_filter` `_ => Vec::new()`
  fallback (`user_groups/mod.rs:~250`) silently returns an empty
  set for non-`Public` filters with no user. Fails closed — but
  silently. If the handler's "non-Public ⇒ authenticated" guard is
  ever weakened, the bug surfaces as "user sees zero groups" with
  no signal. (SLOP-5, TECH-10)
  - **Fix:** return `Err(FilezError::InvalidRequest(...))` — fail
    loud so a future refactor of the handler guard surfaces in
    monitoring instead of in the UI.

- **MAJ-2** ❌ — `list.rs` filter dispatch `match` uses a wildcard
  `other =>` arm. A new `ListUserGroupsFilter` variant added later
  will compile and silently route to the generic `list_with_filter`
  path. (TECH-13, SLOP-10, TECH-13)
  - **Fix:** enumerate every variant explicitly so the compiler
    enforces coverage when a new variant lands.

- **MAJ-3** ❌ — `accept.rs` + `approve.rs` `*_in_transaction`
  helpers are 90% identical (DELETE pending row → check affected →
  INSERT member row). Both will need to be updated in lockstep for
  any audit / notification hook. (REPO-1, TASTE-3, TECH-5)
  - **Fix:** extract a private `promote_pending_to_member` helper
    parameterised over the source table; both handlers call it.

- **MAJ-4** ❌ — `list_with_filter` for `Public` loads the full
  candidate id set into memory (`Vec<UserGroupId>`) BEFORE applying
  `from_index/limit`. At 1M Public groups this is ~16MB per request
  plus the COUNT(*) round-trip. (FUTURE-2, TECH-11, QA-11)
  - **Fix:** push `from_index/limit` into `candidate_ids_for_filter`
    when the filter is `Public` (or just always — small filters are
    naturally tiny) so postgres returns only the paginated window.

- **MAJ-5** ❌ — `users/mod.rs::soft_delete_one` UPDATEs every
  `user_groups` row whose `owner_id` matches the deleted user.
  There is no index on `user_groups.owner_id` — full table scan
  + row-by-row exclusive locks. (DEVOPS-3)
  - **Fix:** new migration `00000000000011_user_groups_owner_idx`
    adding `CREATE INDEX user_groups_by_owner ON user_groups
    (owner_id)`.

- **MAJ-6** ❌ — `update_one` auto-promote uses SELECT-then-loop-
  then-INSERT instead of a single `INSERT … SELECT`. At 10k pending
  requests this doubles the transaction time and holds locks
  longer. (TECH-2, DEVOPS-8)
  - **Fix:** replace the three-step pattern with diesel's
    insert-from-select (or a raw `sql_query("INSERT INTO
    user_user_group_members (user_id, user_group_id, created_time)
    SELECT user_id, $1, now() FROM user_user_group_join_requests
    WHERE user_group_id = $1") `).

- **MAJ-7** ❌ — `tracing::info!` is used as the §7.2 / §7.5 audit
  trail. Tracing is ephemeral, sampled in production, and silently
  drops events under load. The spec calls for a durable audit
  record. (SLOP-6, FUTURE-6)
  - **Fix:** Phase 5 work — add an `audit_log` table with
    `(event_type, actor_id, resource_id, timestamp, metadata jsonb)`
    rows. For now: document the gap explicitly in USER_GROUPS.md and
    leave a `// TODO(audit-log)` marker in each call site so the
    Phase-5 grep is easy.

- **MAJ-8** ❌ — `USER_GROUPS.md §6` spec lists `UserGroupsListMembers`
  as a separate action but the code conflates it with
  `UserGroupsListUsers`. (DOC-1, ARCH-3)
  - **Fix:** decide and document — either rename the enum variant
    to match the spec, or update the spec to call it
    `UserGroupsListUsers` and note the rename rationale.

- **MAJ-9** ⁉️ — Reviewer claimed (DOC-6, REPO-8) that the diff is
  missing the regenerated openapi.json. Verified: `git log` shows
  three codegen regen commits (`f43d8016`, `74162e6c`, `f1c8e6a3`,
  `38569fa7`). The clients ARE regenerated.

- **MAJ-10** ⁉️ — Reviewer claimed (ARCH-1) that the utoipa response
  schema for `update_user_group` references the old field name.
  Verified: the schema correctly references `UpdateUserGroupResponseBody`
  which now wraps `outcome: UpdateUserGroupOutcome`. utoipa derives
  this automatically.

---

## Minor (selected — full list in agent reports)

- **MIN-1** ❌ — `down.sql` for migration 00010 is non-idempotent.
  Diesel runs migrations once, so this is not a runtime concern, but
  a defensive `WHERE … AND deleted = false` would prevent any
  manual mistake. (DEVOPS-5)

- **MIN-2** ❌ — The 1024-char message cap is hardcoded in 3 places
  (invite body, request body, description). (SLOP-7)
  - **Fix:** `const MAX_LIFECYCLE_MESSAGE_LENGTH: usize = 1024;` in
    a shared module.

- **MIN-3** ❌ — `auto_promote_invariant_guard` source-string
  matching is fragile to formatting changes. The pattern is OK as
  a regression smoke test but should not be the only safeguard.
  (QA-8, TECH-7, TASTE-10)
  - **Fix:** complement with an integration test against a real
    postgres (test infra not in repo today — track for Phase 5).

- **MIN-4** ❌ — `UserUserGroupInvitation::new` / `JoinRequest::new`
  are `pub`. External callers could construct invalid rows. (TECH-12)
  - **Fix:** `pub(crate)`.

- **MIN-5** ❌ — `invited_by` FK on `user_user_group_invitations`
  has no CASCADE action — orphans the row if the inviter deletes
  their account before the invitee responds. (TASTE-8)
  - **Fix:** `ON DELETE SET NULL` + make `invited_by` `Option<…>`
    on the model. Captures "invited by a now-deleted user" without
    losing the invitation.

- **MIN-6** ❌ — `accept`/`approve` handlers do a pre-transaction
  `get_one` check before entering the transaction. The transaction
  re-checks via affected-row count. Race window between the two —
  outer returns "No pending …", inner would return "already
  resolved". (QA-10, ARCH-5)
  - **Fix:** drop the outer pre-check entirely; rely on the
    affected-row count for the 404. Single round trip + uniform
    error message.

- **MIN-7** ❌ — `accept`/`approve` insert uses
  `on_conflict_do_nothing()` on the member insert. If a concurrent
  path already added the member, the operation silently succeeds
  with the request/invitation deleted but no new member created.
  (SLOP-2)
  - **Fix:** check the insert's affected count. If 0, the row was
    already a member — log it (this is a real signal) and proceed.

- **MIN-8** ❌ — Reviewer noted (ARCH-6) that the `nobody` sentinel
  check in `users/delete.rs` runs AFTER the access-control check.
  An attacker who somehow obtained `UsersDelete` permission could
  attempt to soft-delete the sentinel and at least learn it exists
  via the error message. Low impact (sentinel existence is public
  by spec), but the cleaner shape is to reject at the handler entry
  point.
  - **Fix:** early `if user_id == NOBODY_USER_ID { return Err… }`
    before the auth check.

- **MIN-9** ❌ — `create_one` does not seed any default policies.
  USER_GROUPS.md §6 implies the owner gets a full set + members
  get list-related actions at creation time. Currently the owner is
  covered by the implicit owner-grant, but no member has any
  access to anything until the owner manually creates policies.
  This blocks the Phase 4 exit criterion ("user can request to join
  and have owner approve") for non-owner flows. (DOC-5, ARCH-3)
  - **Fix:** Phase 4 follow-up — bootstrap default policies in
    `create_one`. Out of scope for THIS multi-review pass; tracked
    as a separate task.

- **MIN-10** ❌ — Pending-action models (`UserUserGroupInvitation` +
  `UserUserGroupJoinRequest`) duplicate 7 methods each. A trait
  + macro would dedupe. (REPO-2, REPO-3, REPO-11)
  - **Fix:** Optional cleanup; the duplication is bounded (two
    types, no future siblings planned). Mark as low priority.

- **MIN-11** ❌ — `mows-vm-supervisor` and other unrelated crates
  carry pre-existing dead-code/unused-import warnings that surface
  during cargo check. Not new in this diff but noisy.
  - **Fix:** out of scope.

---

## Action plan

Fix in order:
1. CRIT-1, CRIT-2 (single commit, mechanical)
2. CRIT-3 (delete-handler atomicity — single commit)
3. MAJ-1 + MAJ-2 (fail-loud + exhaustive match — single commit)
4. MAJ-5 (owner_id index — new migration, verify against
   throwaway postgres)
5. MAJ-3 (extract `promote_pending_to_member` helper)
6. MAJ-6 (insert-from-select for auto-promote)
7. MAJ-4 (push pagination into `candidate_ids_for_filter`)
8. MIN-7 (tighten member-insert race semantics)
9. MIN-2, MIN-6, MIN-8 (small consistency fixes)
10. MAJ-8 (spec/code rename for ListMembers vs ListUsers)
11. MAJ-7 (audit-log marker comments — Phase-5 prep)
12. MIN-9 (default-policy bootstrap — separate focused PR)
