# Phase 4 Frontend Multi-Review

4-perspective review (Security, Technology, QA, Slop) of the Phase 4
closing batch: utoipa-repr codegen fix + regenerated TS/Rust clients +
six new React components (UserGroupCreate, UserGroupSettings,
UserGroupList, UserGroupDetail, UserGroupPicker,
UserGroupPendingDashboard) + translations (en-US, de) + 22 vitest
tests.

Markers: `❌` open, `✅` resolved, `⁉️` deferred / not-real.

## Summary

| Perspective | Critical | Major | Minor |
| ----------- | -------- | ----- | ----- |
| Security    | 0        | 0     | 0 (review found no exploitable issues; 3 informational) |
| Technology  | 0        | 4     | 10    |
| QA          | 1        | 4     | 7     |
| Slop        | 1        | 6     | 6     |

After dedup: **8 actionable** items, **8 deferred / not-real** items.

## Actionable

- **A1** ✅ — Badge enum-to-translation-key ternary chains are
  duplicated three times: `UserGroupList.renderVisibilityBadge`,
  `UserGroupList.renderJoinPolicyBadge`, and
  `UserGroupDetail.renderHeader` (SLOP-1, SLOP-2). A future variant
  addition has to be hand-mirrored in three call sites.
  **Fix:** extract `mapGroupVisibility(GroupVisibility, t)` and
  `mapGroupJoinPolicy(GroupJoinPolicy, t)` helpers into
  `userGroups/labels.ts`; consume from both components.

- **A2** ✅ — Pending-invitation / join-request rows render a bare
  UUID as the title because the API doesn't carry the resolved
  `group_name` / `display_name` (TECH-3, TECH-13, SLOP-6, Security
  informational). Users can't make accept/decline decisions without
  knowing what group / who is being referenced.
  **Fix:** label the displayed ID explicitly so the UI is at least
  honest about the shape (e.g. prefix with "Group ID:" / "User ID:")
  until a follow-up backend pass adds the resolved fields. Document
  the gap inline so the Phase 5/7 UI work catches it.

- **A3** ✅ — Every catch block surfaces `error.message` verbatim,
  which can leak server-side stack-trace text into the UI (TECH-4,
  SLOP-5). The catch sits at the network boundary so the raw shape is
  unfiltered.
  **Fix:** restrict the user-visible string to the translated fallback
  (`t.userGroupCreate.createFailed` etc.). Keep the raw error via
  `log.error` so debugging info doesn't disappear.

- **A4** ✅ — `handleVisibilityChange` / `handleJoinPolicyChange` cast
  the incoming string straight to the enum without checking it's a
  member of the enum (TECH-7, SLOP-8). A future swap from `<Select>`
  to a freeform input would silently let garbage land in state.
  **Fix:** guard with `Object.values(GroupVisibility).includes(value)`
  before set state; ignore invalid values.

- **A5** ✅ — `openapi_schema_shape` tests assert `type === "string"`
  but don't assert the enum has zero integer members (TECH-11). A
  utoipa version that emits both `enum: [0, 1, 2]` AND `enum: ["A",
  "B", "C"]` (oneOf-style) would slip through.
  **Fix:** in `assert_string_enum`, iterate the `enum` array and
  `assert!(v.is_string())` on each member.

- **A6** ✅ — Coverage gaps in the new vitest files (QA-1, QA-2, QA-4,
  QA-5, SLOP-11): tab switching in `UserGroupList`, `filter` prop in
  `UserGroupPicker`, non-member-of-InviteOnly state in
  `UserGroupDetail`, and visibility-only / join-policy-only changesets
  in `UserGroupSettings`.
  **Fix:** add one focused test per gap.

- **A7** ✅ — `buildUserGroup` uses `as UserGroup` to skip the
  `materialize_uga: boolean` field (SLOP-10). A future required field
  on the wire type wouldn't fail the build.
  **Fix:** drop the cast, supply `materialize_uga: false` explicitly.

- **A8** ✅ — `MockFilezProvider`'s proxy is cast `as unknown as
  Api<unknown>` (TECH-2). The `as unknown as` ladder is the canonical
  TypeScript escape hatch for "I know better"; here it hides any
  drift between the mocked surface and the real `Api` shape.
  **Fix:** type the proxy target as `Api<unknown>["api"]` and let TS
  catch missing fields.

## Deferred

- **D1** ⁉️ — `UserGroupDetail` is ~600 lines with four tabs (TECH-6).
  Splitting into `UserGroupMembersTab` / `UserGroupInvitationsTab` /
  `UserGroupJoinRequestsTab` is a fair refactor but the current shape
  is testable and the multi-review tests already pin the visible
  contract. Defer to a Phase 7 cleanup PR.

- **D2** ⁉️ — Translation-key existence tests (TECH-9). The Translation
  interface declaration-merge already forces missing keys to fail at
  compile time; the runtime test is belt-and-braces. Defer.

- **D3** ⁉️ — Add a "ListScope is not affected" caveat to the Cargo.toml
  comment (TECH-10). Strict prose nit, low value.

- **D4** ⁉️ — Document the PureComponent shallow-compare contract in
  every component header (TECH-12). Low signal-per-line; the audit
  already caught zero violations.

- **D5** ⁉️ — `async componentDidMount` / `componentDidUpdate` pattern
  (TECH-1, TECH-5, TECH-8). The reviewer's "rejection before try" is
  not how `async` functions reject — every code path runs inside
  `loadGroups()` whose body is wrapped in try/catch. The pattern
  mirrors the canonical `FileGroupCreate` / `FileGroupPicker`. Defer
  any change until the upstream pattern moves first.

- **D6** ⁉️ — Verify the `apiOk()` mock shape against real server
  responses (QA-6). The shape `{ data: { status, message, data } }`
  comes from `ApiResponse<T>` in utoipa and is the same pattern other
  filez tests use; any drift breaks every test together. Out of scope
  for this batch.

- **D7** ⁉️ — Replace translation-text assertions with translation-key
  fixtures (QA-7). Worth doing but invasive across every existing test
  file; track as a separate cleanup PR.

- **D8** ⁉️ — Add `componentWillUnmount` + AbortController to cancel
  in-flight requests so busy flags don't leak (SLOP-12). Real edge
  case but bigger than this batch — adding it for one component
  creates inconsistency; the codebase has no precedent yet. Track
  separately.

## Not-real findings

- **SLOP-3** ⁉️ — Claims `ListUserGroupsFilter.AccessGranted` is not in
  the API. Verified: it IS defined (`api-client.ts:75`).

- **SLOP-4** ⁉️ — Claims the unmocked-method-throws mock hides bugs.
  Inverted: throwing loud is the *point* — a silent default would
  mask missing mocks. Defending the design.

- **SLOP-7** ⁉️ — Claims triple-fire on single-group auto-select. The
  guard `userGroups.length === 1 && !this.props.value` prevents the
  re-fire once a value has been set; not a real bug.

- **SLOP-9** ⁉️ — Optional-chaining swallows missing levels in
  `createUserGroup` response. Mirrors the canonical
  `FileGroupCreate` pattern; consistency wins over per-component
  logging.

- **SLOP-13** ⁉️ — Claims `USER_GROUP_LIST_FILTERS` is exported but
  unused internally. Verified: it IS used inside `render()` (the tab
  list iterates over it).

- **TECH-14** ⁉️ — Claims `wire_stable_values` tests are redundant
  with `const _` discriminant asserts. Different concern: the const
  asserts catch a removed/renumbered variant at compile time; the
  runtime tests pin the serde round-trip via `as i16`. Keep both.

- **QA-8** ⁉️ — Claims `deleteBusy` isn't cleared on failure. Verified:
  the catch block sets `deleteBusy: false` directly. False positive.

- **QA-11** ⁉️ — Suggests adding a round-trip from openapi.json to the
  TS codegen. Already covered indirectly: codegen.sh fails if the spec
  is unparseable, and the `openapi_schema_shape` test pins the spec
  shape that the codegen consumes.

## Action plan

Fix in this order to keep diffs small and reviewable:
1. A5 — schema-shape test tightening (smallest, low risk)
2. A7 — explicit `materialize_uga` in builder
3. A8 — strongly-type the mock proxy
4. A4 — enum-cast guard
5. A3 — error-message gating
6. A1 — extract label helpers
7. A2 — clarify UUID labels
8. A6 — add the missing tests
