# OPEN_QUESTIONS — Decisions still to make

For each: the question, the options, the trade-offs, and a tentative
recommendation. None of these are settled. Each is intentionally written
so a future agent (or you) can pick it up and decide without re-deriving
the context.

---

## Q1 — Should `mows-auth-core` be a Rust crate or a sidecar service?

**Crate (recommended):** single Postgres round-trip per check. No extra
container. The shape that matches the filez-today performance profile.
Trades off cross-language usage — a Python service would need bindings or
to re-implement the engine.

**Sidecar:** language-agnostic. Adds at least one Unix-socket or gRPC
round-trip per check. Easier to operate independently. Wins if we expect
non-Rust services soon.

**Recommendation:** crate. We have no non-Rust MOWS services on the
roadmap, and the latency cost of a sidecar would dominate the engine's
real cost. Revisit if a non-Rust service appears.

---

## Q2 — Resource-type integer space

Each service declares resource-type integers in its registry. If two
services run in the same cluster (different Postgres schemas), do they
share an integer space or have private ones?

**Private (per-service):** simpler; today's filez approach.

**Shared (global registry of (service, type) → int):** lets a future
admin dashboard list "all resources of any service" with a single shape.
Requires a coordination point.

**Recommendation:** partition the `u16` range. e.g. `0–999` reserved for
filez, `1000–1999` for Pektin, etc. Documented in `mows-auth-core`.
Cheap, no coordination, future-proof for the rare cross-service tool.

---

## Q3 — Policy expiration enforcement

We add `expires_at` to `access_policies` (DATA_MODEL.md §2.4). When a
policy passes its expiration:

- **Soft (recommended):** the check engine's `WHERE` clause filters it
  out. Row stays for audit. A background job *can* set `revoked=TRUE`
  for tidy-up, but not required.
- **Hard:** a cron job deletes expired rows.

Recommendation: soft. Audit trail matters more than table cleanliness.
Add the cron only when the policy table becomes problematically large.

---

## Q4 — Group admins (plural) — or just one owner?

Today: one owner per group. A group with 200 members has one bottleneck
human who must approve every join request.

**Just-owner (recommended for v1):** matches today's filez. Simplest.

**Owner + admins:** new table `user_user_group_admins`, new column
`access_policies` doesn't need changing because admins' rights are
delegated by additional access_policy rows.

**Recommendation:** ship v1 with just-owner; track this as a v2
ergonomics improvement. The data model accommodates it without
migration when the time comes (a policy granting `UserGroupsApprove` to
specific members is already legal).

---

## Q5 — Where do "roles" (templates) live?

The IDEA.md doesn't mention roles, but real users will inevitably want
"give Mike the editor role on this folder". Options:

- **No roles, just policy templates in the UI.** The server stores only
  the expanded policies. Pros: no second source of truth. Cons: changing
  a template doesn't change already-applied instances.
- **First-class roles** (`role_templates(id, name, actions[])`) plus
  `role_assignments(role_id, subject, resource)`. Cons: doubles the
  surface area.

**Recommendation:** punt to v2. For v1, ship policy templates as a
*frontend* concept (presets in the share dialog).

---

## Q6 — Caching `check()` results

Filez does not cache. Many requests use the same `(subject, app, resource,
action)`. Caching would help.

Options:

- **No cache (recommended for v1).** Each check is one Postgres call.
  Simpler invariants.
- **Per-request cache.** Memoise within a single HTTP handler if it
  checks the same tuple twice. Trivially safe.
- **TTL cache (e.g. 1s).** Helps when many short bursts come from one
  user but introduces brief stale-allow on revocation.

**Recommendation:** add per-request memoisation only when a profile shows
it matters. Avoid TTL caches; the invalidation cost outweighs the
latency win until proven otherwise.

---

## Q7 — Tying authentication to authorization

When a user logs in via Zitadel, we currently create / update a `users`
row keyed by `external_user_id`. Should the OIDC token *itself* carry any
authorization info?

**No (recommended).** The token is for authentication. All authorization
lives in `access_policies`. Keeps the two systems independent and avoids
"my JWT says I'm admin but the DB says otherwise" drift.

**Yes (limited):** echo the user's superadmin status into a custom claim
for the manager UI to render correctly without an extra round-trip.

**Recommendation:** no token-borne authorization. The manager UI can
fetch `GET /me` on load — one cheap call.

---

## Q8 — Cross-resource Allow ("everything in folder X")

We support `via_group` (resource is a member of resource_group G) and
`OwnedByOwner` (resource has the same owner as the policy). Do we also
need a "child of"-style relation, e.g. for a future filesystem service
where `/photos/2024/*` should be one Allow?

The expressivity gap is real, but the engine cost of evaluating a
path-prefix predicate per resource is large. Three options:

- **Don't support it; require explicit groups.** Forces a service that
  needs path-grouping (e.g. a hierarchical FS) to maintain a
  `path_membership` table that re-uses the existing resource-group
  machinery.
- **Add a `resource_path_prefix` policy column** (`TEXT`, indexed with
  `text_pattern_ops`). Lets the engine WHERE `resource_path LIKE
  '/photos/2024/%'`.
- **Closure tables.** Per-service.

**Recommendation:** option (a). Don't bloat the core; make hierarchical
services responsible for materialising their hierarchy as resource
groups (one group per directory). The cost is the same and the engine
stays small.

---

## Q9 — Audit log

A separate `access_policy_audit` table or use the existing `events`
table (which filez has)?

**Use `events` (recommended).** Filez already has an `events` table with
`(event_type, user_id, resource_ids[], resource_type, app_id, result
JSONB)`. Add event types for the policy lifecycle (`PolicyCreated`,
`PolicyRevoked`, `PolicyExpired`, `AccessDenied`). Tracks both the
operational events and the auth decisions in one place.

---

## Q10 — Cross-service single sign-on of authorization

**Resolved by AUTHENTICATION.md.** The decision recorded there:

- One shared `mows_auth.apps` table in the `mows_auth` schema, owned
  by the auth-service repo (DEPLOYMENT.md §"What lives in
  `mows_auth`"). All services read from it; only the auth service
  (and Zitadel-sync tooling) writes to it.
- The join key is `external_client_id` (the Zitadel OIDC
  `client_id`). Zitadel is the source of truth for app existence;
  `mows_auth.apps` is a thin projection.
- The manager UI is seeded as a Zitadel client at cluster install
  by mpm; its `mows_auth.apps` row is inserted in the same install
  step with `trusted = true`.
- A user's Zitadel access token works against every API in the
  cluster project (AUTHENTICATION.md §6.3) — no per-service login.

The earlier sketch of per-service `apps` tables with deterministic
id derivation is superseded; the shared-schema approach in
DEPLOYMENT.md makes a single table both possible and preferable.

---

## Q11 — Public-link cryptographic capability tokens

Today an anonymous share is a `subject=Public` policy plus the resource
ID. The "secret" is the resource ID itself — anyone who knows the UUID
can hit it. UUIDv4 has enough entropy (~122 bits) to make brute-force
infeasible, but the URL is the capability, which is the cleanest model.

Open: should we additionally issue *signed* capability tokens (e.g. a
JWS the server signs) that we can revoke without revoking the underlying
policy? Useful for "give this link to X people for 24 hours then
auto-expire" UX.

**Recommendation:** v2. v1 = policy `expires_at` covers the auto-expire.
Per-link revocation is the v2 enhancement (issuing one cap-token per
share-link, storing them with `expires_at`, and the link contains the
token instead of (or in addition to) the resource id).

---

## Q12 — Should ServerMember and Public be the same axis?

Today they are distinct `subject_type` values: a `ServerMember` policy
applies to any logged-in user; a `Public` policy applies to anyone.

We could collapse them into a single `subject_type = Audience` with a
sub-discriminator. Doesn't change behaviour, slightly fewer rows in the
enum, slightly more code in the predicate. Not worth churning.

**Recommendation:** keep them distinct. Matches today, matches the UI.

---

## Q13 — Default policies on resource creation

When a user creates a resource (file, group, …), do we automatically
insert any policies?

**Recommendation:** no implicit row insertion. The ownership shortcut
(POLICY_SEMANTICS.md §2.2 / §3 step 4) handles the common case. Implicit
rows would create thousands of essentially-empty policy entries
("owner can read, write, delete, list — for every file ever").

**Exception:** when a resource is created inside a group, optionally
inherit the group's policies. We do this at *evaluation* time
(via the existing group-membership predicate), not at *write* time.

---

## Q14 — Negative answers leak existence?

Returning `ResourceNotFound` instead of `Forbidden` for a resource the
user doesn't even have visibility into would tell an attacker the
resource doesn't exist. Today filez returns the same `AuthEvaluation`
shape for both, with a `reason` field — but the HTTP layer collapses
both to 403 by default.

**Recommendation:** 403 for both "exists but you can't" and "doesn't
exist". Internal audit logs preserve the distinction; the outside world
sees the same response.

---

## Q15 — Versioning policies

When the manager UI edits a policy, do we keep history?

**Recommendation:** v2. v1 has `revoked` (soft delete) — enough to undo
within the lifetime of a row. Full versioning is overkill for the
expected change volume.
