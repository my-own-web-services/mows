# POLICY_SEMANTICS — How a check resolves to Allow or Deny

This is the canonical specification of the evaluator. The current filez code
in `apis/cloud/filez/server/src/models/access_policies/check.rs` matches
most of it; differences are flagged with **NEW** and described in DATA_MODEL.md.

## 1. Inputs to a check

A `check(...)` call takes:

| Input                       | Type                                | Notes                                                                 |
| --------------------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `requesting_user`           | `Option<&MowsUser>`                 | `None` for fully anonymous requests                                   |
| `requesting_user_groups`    | `Option<&[MowsUserGroupId]>`        | Derived from `requesting_user`; computed once per request             |
| `context_app`               | `&MowsApp`                          | Resolved from origin / service-account / "no-origin" sentinel         |
| `resource_type`             | `u16`                               | Registered in the service's `ResourceTypeRegistry`                    |
| `requested_resource_ids`    | `Option<&[Uuid]>`                   | `None` ⇒ *type-level* check (e.g. "may I create one?")                |
| `action`                    | `u16`                               | Service-defined integer; must be in the type's action set             |

The output is an `AuthResult`:

```rust
pub struct AuthResult {
    pub access_granted: bool,         // true ⇔ all evaluations allowed
    pub evaluations: Vec<AuthEvaluation>,
}

pub struct AuthEvaluation {
    pub resource_id: Option<Uuid>,    // None ⇔ type-level check
    pub is_allowed: bool,
    pub reason: AuthReason,           // why this evaluation came out that way
}
```

`AuthReason` is an enumeration of every distinct path through the
algorithm (Owned, AllowedByDirectUserPolicy{policy_id}, DeniedByGroupPolicy{…},
SuperAdmin, ResourceNotFound, NoMatchingAllowPolicy, etc.). The reasons exist
so the audit log and the "why was I denied?" UI never have to guess.

## 2. Short-circuits (in order)

The engine returns early for these cases, in this order. If none match, it
falls through to §3.

### 2.1 SuperAdmin user

If `requesting_user.user_type == SuperAdmin`, return Allow for every
requested resource id with reason `SuperAdmin`. No further work.

### 2.2 Trusted app + owned resources

If `context_app.trusted == TRUE` and `requesting_user` is `Some(u)` and
*every* requested resource id is owned by `u` (verified by a single SELECT
over the resource table's owner column), return Allow with reason `Owned`.

Rationale: the manager UI and the first-party filez UI bypass the policy
table for self-owned operations; we save one full evaluation per request.

### 2.3 Empty request

If `requested_resource_ids = Some(&[])` ⇒ error
`Evaluation("No resource IDs provided")`. (This is a programming error in
the caller; callers must check non-emptiness or pass `None`.)

## 3. Per-resource evaluation (instance-level)

For each `resource_id` in `requested_resource_ids` we compute a single
`AuthEvaluation`. The procedure:

1. **Resource exists?** If the owner-fetch query didn't return a row for
   this id, the evaluation is Deny with reason `ResourceNotFound`. No
   policy is consulted. *Rationale: leaking existence of unowned
   resources via auth errors is a footgun.*

2. **Collect candidate policies.**
   - *Direct* policies: `resource_type = T AND resource_id = R AND
     context_app_ids @> {context_app.id} AND actions @> {action} AND
     subject filter`.
   - *Resource-group* policies: for every group `G` that contains `R`,
     `resource_type = resource_group_type(T) AND resource_id = G AND
     context_app_ids @> {context_app.id} AND actions @> {action} AND
     subject filter`.
   - The *subject filter* expands to:
     `(subject_type = User AND subject_id = requesting_user.id)
      OR (subject_type = UserGroup AND subject_id = ANY(requesting_user_groups))
      OR (subject_type = ServerMember AND requesting_user IS NOT NULL)
      OR (subject_type = Public)`.
   - Plus the **NEW** `resource_scope` extensions (§4 below).

3. **Apply DENY precedence.** If any candidate policy with effect=Deny
   matches, the evaluation is Deny with the corresponding `AuthReason`
   variant. Stop.

4. **Apply OWNERSHIP shortcut.** Else, if `requesting_user` is some `u`
   and `owners_map[R] == u.id`, the evaluation is Allow with reason
   `Owned`. Stop.

5. **Apply ALLOW.** Else, if any candidate policy with effect=Allow
   matches, the evaluation is Allow with the corresponding `AuthReason`
   variant. Stop.

6. **Default deny.** Else, the evaluation is Deny with reason
   `NoMatchingAllowPolicy`.

The overall `access_granted` is `true` iff every evaluation is allowed.

This is exactly what filez does today; the formalism makes the order
auditable and the next two extensions painless to add.

## 4. NEW — `resource_scope` extensions

(Recap from DATA_MODEL.md §2.4.) `resource_scope` lets a single policy row
apply to a *set* of resources without enumerating them.

In step §3.2 above, the policy-candidate query is extended so that for a
given `(requesting_user, context_app, resource_type, action)` we also
consider rows with:

- `resource_scope = OwnedByOwner` and `resource_id IS NULL` and `resource_type = T`:
  the implicit per-row predicate adds `EXISTS (SELECT 1 FROM {table_for_T}
  WHERE id = R AND owner_id = access_policies.owner_id)`. In other words,
  the policy applies if `R` is owned by the policy's owner.

- `resource_scope = AccessibleByOwner` and `resource_id IS NULL` and
  `resource_type = T`: the implicit predicate is "the policy's owner has
  Allow on R via *this* `(action, resource_type)` modulo
  `AccessibleByOwner` policies themselves (cycle break)". Implementation:

    - Reduce to step §3 on `R` with `requesting_user = policy.owner`,
      `context_app = policy.context_app`, omitting any
      `AccessibleByOwner` rows owned by `policy.owner` from the
      candidate set.
    - If that nested check returns Allow ⇒ this policy is a candidate.

    The cycle break is essential: `AccessibleByOwner` policies must not
    self-amplify ("X gives me access ⇒ X gives me access ⇒ …"). The
    omission rule is the smallest change that breaks the cycle.

In production this is one extra SELECT per evaluation in the worst case;
the index `ap_subject_idx (subject_type, subject_id, resource_type)`
covers both new lookups.

## 5. Type-level evaluation

When `requested_resource_ids = None`, the engine asks "may this subject
perform action A on the *type* T?". The procedure:

1. SuperAdmin short-circuit as above.
2. Trusted-app short-circuit *does not* apply (no resources to own).
3. Candidate policies are those with `resource_id IS NULL` matching the
   `(resource_type, action, context_app, subject filter)`.
4. Apply Deny then Allow as in §3 (steps 3 and 5). No ownership check.
5. Default deny.

Filez uses this for "create" operations (e.g. `FilezFilesCreate`). The
type-level form is also the natural place to encode service-wide
restrictions like "only SuperAdmins may create user_groups", expressed as
a global Allow policy with `subject_type=ServerMember` *omitted* (i.e.
default deny stands).

A special `verify_allow_type_level()` helper grants the operation when no
explicit Deny exists, even with no Allow. Filez uses this so users can
create their own files without a policy. We keep that helper but document
that the default for type-level is *deny unless a service opts in*; filez
opts in for `FilezFilesCreate`.

## 6. Audit reasons — exhaustive list

(Subset of filez's `AuthReason`. Anything **NEW** is for the new scopes.)

| Variant                                       | When emitted                                  |
| --------------------------------------------- | --------------------------------------------- |
| `SuperAdmin`                                  | §2.1 short-circuit                            |
| `Owned`                                       | §2.2 or §3 step 4 (ownership)                 |
| `AllowedByPubliclyAccessible{policy_id}`      | Allow via `subject_type=Public`               |
| `AllowedByServerAccessible{policy_id}`        | Allow via `subject_type=ServerMember`         |
| `AllowedByDirectUserPolicy{policy_id}`        | Allow via `subject_type=User` direct on R     |
| `AllowedByDirectUserGroupPolicy{policy_id, via_user_group_id}` | Allow via UserGroup direct  |
| `AllowedByResourceGroupUserPolicy{policy_id, on_resource_group_id}` | Allow via User on group |
| `AllowedByResourceGroupUserGroupPolicy{…}`    | Allow via UserGroup on group of R             |
| `AllowedByOwnedByOwnerPolicy{policy_id}` **NEW** | Allow via `resource_scope=OwnedByOwner`     |
| `AllowedByAccessibleByOwnerPolicy{policy_id}` **NEW** | Allow via `AccessibleByOwner` (chain)  |
| `DeniedByPubliclyAccessible{policy_id}`       | Deny via Public                               |
| `DeniedByServerAccessible{policy_id}`         | Deny via ServerMember                         |
| `DeniedByDirectUserPolicy{policy_id}`         | Deny via User direct                          |
| `DeniedByDirectUserGroupPolicy{…}`            | Deny via UserGroup direct                     |
| `DeniedByResourceGroupUserPolicy{…}`          | Deny via User on group                        |
| `DeniedByResourceGroupUserGroupPolicy{…}`     | Deny via UserGroup on group                   |
| `DeniedByOwnedByOwnerPolicy{policy_id}` **NEW** | Deny via OwnedByOwner                       |
| `DeniedByAccessibleByOwnerPolicy{…}` **NEW**  | Deny via AccessibleByOwner                    |
| `NoMatchingAllowPolicy`                       | Default deny                                  |
| `ResourceNotFound`                            | §3.1                                          |

`AuthEvaluation` always carries the `resource_id` (`None` for type-level)
and the `is_allowed` boolean. The reason is for the audit log and the UI;
the boolean is what the handler branches on.

## 7. Things the engine deliberately does *not* do

- **No caching.** Filez does not cache today and the latency is fine.
  Caching introduces invalidation; we'd rather pay the round-trip than the
  bug. (See OPEN_QUESTIONS.md if numbers force the issue.)
- **No expression evaluation.** No "if time of day…" branches.
- **No cross-service queries.** Each service evaluates against its own
  Postgres. The shared crate uses the service's connection pool.
- **No deferred deny.** Deny is evaluated synchronously. If a Deny is
  added a moment after a request enters the handler but before the
  database commits, that request still proceeds with the snapshot the
  transaction started from. This is acceptable for v1; the alternative
  is a row-level lock per check and the cost is prohibitive.

## 8. Concurrency model

Each `check(...)` runs in the caller's request context using the caller's
connection. There is no shared mutable state in the engine. The
`ResourceTypeRegistry` is constructed once at startup and is `Send + Sync`.

A pair of concurrent requests modifying overlapping policies is serialised
by Postgres in the normal way — there is no engine-side coordination.

## 9. Test obligations

The shared crate ships with the following test categories, all enforced by
CI:

1. **Algorithm tests.** Property tests over generated `(subjects, groups,
   resources, policies)` inputs. Properties:
   - Adding a Deny never increases allowed set.
   - Adding an Allow never decreases allowed set.
   - SuperAdmin always allowed.
   - `resource_scope=OwnedByOwner` ⊆ `resource_scope=Single` for the
     same set of explicit shares (the scope is additive).
   - `AccessibleByOwner` chain breaks after one hop (no infinite
     recursion).
2. **SQL/diesel tests.** A docker-compose Postgres (mirroring filez's
   `dev-db.compose.yaml`) with the migrations applied; tests insert rows
   and assert `check()` / `list_allowed()` results.
3. **Migration tests.** Apply each migration on a snapshot of the old
   schema with sample rows; assert the data survives and the new defaults
   look right.
4. **Performance tests.** Bench `check()` on 100k policies × 10 groups
   per user × 10 resource groups per resource — must stay under the
   filez baseline.

The integration tests use a real Postgres, never mocks (per the CLAUDE.md
preference).
