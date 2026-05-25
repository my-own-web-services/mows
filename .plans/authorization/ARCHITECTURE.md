# ARCHITECTURE — MOWS Authorization

## 1. What we are building

A cluster-wide authorization system for MOWS that:

1. Answers the *point* question — "is principal P allowed to perform action A
   on resource R via app C?" — in a single round-trip.
2. Answers the *listing* question — "which resources of type T may principal
   P see / act on via app C?" — without scanning the world.
3. Lets multiple MOWS services (filez today, others tomorrow) plug in their
   own resource types and actions without re-implementing the engine.
4. Treats users, user groups, the set of all logged-in users, and the
   anonymous public as uniform "subjects" so the same policy machinery covers
   private files, shared folders, server-internal directories, and fully
   public links.
5. Treats apps as a separate *context* dimension: the same user/resource pair
   may be allowed via app X and denied via app Y. This is what lets a user
   say "yes, photo gallery may see my pictures, but the chat app may not."
6. Supports account-less app access: a user can pre-authorize an app so it
   can read a resource even when the user is offline (think public link with
   an extra "only this app" guard).

What we are explicitly **not** building:

- Federation across clusters (out of scope for v1; the resource_id space is
  per-cluster).
- Attribute-based / arbitrary-predicate policies. The expressivity ceiling is
  `(subject, resource[group], action[s], app, effect)`. If we need richer
  rules later, we add a separate evaluator alongside; we do not bend this one.
- A general-purpose policy language. See README §"What this design is not".

## 2. Why generalise beyond filez

Filez today is the only production consumer of the access-policy code path,
but the engine inside `apis/cloud/filez/server/src/models/access_policies/`
already encodes a generic shape: subjects, resources, groups, actions, apps,
effect. Several MOWS components on the horizon need the same machinery
(Pektin entries, future calendar / mail / notes services, the manager UI
itself once it gains multi-user mode). Duplicating the engine per service
would mean:

- five places to find a permission bug
- divergent policy schemas, breaking the unified UX of *"share this with X"*
- no path to a single dashboard answering "what does Paul have access to?"

So the design goal is: **extract the engine into a shared crate, keep filez
as the first real consumer, build the second consumer (Pektin or the manager)
right after, and let the abstraction be validated by that second consumer.**

## 3. Major design choices and the reasoning

### 3.1 Policies live in Postgres rows, not in a DSL

**Choice.** Each `access_policy` is a row. A row is
`(subject_type, subject_id, context_app_ids[], resource_type, resource_id?,
actions[], effect)`. No expressions, no scripting.

**Why.** The IDEA.md primitives are all enumerable. Every "share" the spec
describes can be expressed as `N` rows. Storing as rows means:

- listing is a JOIN, not an interpreter walk;
- the policy editor UI is a CRUD form, not an IDE;
- audit is a SELECT;
- we can index on every column that matters.

**What we give up.** Rules of the form *"deny access between 22:00 and 06:00
for users whose country is not DE"*. These are out of scope. If we ever need
them, we add a sidecar rule evaluator gated by the same row-level Allow.

### 3.2 Subjects are a union, but flattened in the row

**Choice.** `subject_type` ∈ {User, UserGroup, ServerMember, Public}.
`subject_id` is a UUID for User and UserGroup, and is the all-zeros UUID for
ServerMember and Public (so the column stays NOT NULL and indexable).

**Why.** This is what filez does today and it works: every policy query is
either `subject_id = $1` or `subject_id = ANY($2)` or a static check against
`subject_type`. No discriminated-union pain in SQL.

### 3.3 Resources are addressed by `(type, id)`, with `id` nullable for
type-level policies

**Choice.** A policy with `resource_id IS NULL` is a *type-level* policy —
"this subject may perform action A on the *type* T". The canonical use is
`(User=Paul, action=FilesCreate, resource_type=File, resource_id=NULL)`
meaning "Paul may create files".

**Why.** Filez already uses this and the alternative — modelling
"create" as a separate global-resource type — duplicates the schema and
forces an extra resource row per service. Keeping it nullable means one
table, one query path.

**Invariant.** Per-row trigger: if `resource_id IS NOT NULL` then it must
reference an existing row of the table that owns that resource type. The
binding is done by the `get_auth_params_for_resource_type()` mapping —
see DATA_MODEL.md §"Resource registry".

### 3.4 Apps are a context dimension, not subjects

**Choice.** Apps appear in policies via `context_app_ids[]`. The principal is
*always* a user (or absent, for public access). When an app is acting on
behalf of a user, the request carries both pieces of identity, and the policy
must match on both.

**Why.** Modelling apps as subjects would make "Paul shares X with the chat
app for himself" require Paul to grant access *to the chat app's identity*,
which is a different mental model from "Paul lets the chat app act on his
behalf for X". The latter is what users actually mean.

**Account-less app access** (IDEA.md §Apps) is the special case
`maybe_requesting_user = None, context_app_ids contains X, subject_type =
Public`. The check engine already handles this branch — see filez
`check_resources_access_control` `match maybe_requested_resource_ids` arms.

**Trusted apps** are a row attribute on `apps.trusted`. When a trusted app
acts on behalf of a user, the engine short-circuits to Allow if all requested
resources are owned by that user. This is the *only* place where the engine
bypasses the policy table; the rationale is operational (the manager UI, the
first-party filez frontend) and the trust is administrator-granted, not
user-granted.

### 3.5 Effect = {Allow, Deny}, with Deny dominant

**Choice.** Default-deny. Allow rows grant. Deny rows are checked first; a
single matching Deny defeats every Allow.

**Why.** The four-quadrant alternative (default-allow, default-deny, with or
without overrides) was rejected because:

- default-allow couples poorly with the *Public* subject (everyone sees
  everything by accident is the worst failure mode);
- Deny-wins lets a user revoke a previous broad share with a narrow rule
  ("this group can read everything in folder X except this one file"),
  which is the common UX expectation.

### 3.6 Group memberships go through join tables, never arrays

**Choice.** `user_user_group_members(user_id, user_group_id)` and
`*_group_members(resource_id, group_id)`. Never store group membership as a
Postgres array column.

**Why.** Arrays don't compose with JOINs; we need a JOIN every time we list
("for each resource of type T, also fetch policies attached to any group
the resource is in"). Arrays would force GIN indexes and ANY()-rewrites;
join tables give us composite-key primary indexes and standard plans.

### 3.7a **Single auth primitive — no bespoke queries per handler**

**Choice.** The shared crate exposes exactly two functions to every
service:

- `check_access(subject, app, resource_type, resource_id, action) →
  AuthResult` — for `GET /<x>/:id`, `PUT /<x>/:id`, `DELETE /<x>/:id`,
  `POST /<x>` (with `resource_id = None` for the create-type-level form).
- `list_visible(subject, app, resource_type, action, scope, cursor,
  page_size) → Vec<(resource_id, sort_key)>` — for `GET /<x>` and any
  paginated listing. The handler then fetches display columns with a
  pure `WHERE id = ANY($1)` lookup that contains **no auth predicate
  whatsoever.**

No handler writes its own filter. No handler composes SQL with
returned fragments. No handler short-circuits "I know this is my own
file so I'll skip the check." Every code path that returns or mutates
a resource goes through one of those two functions.

**Why.** If each REST endpoint owns its own auth query — even just
a `WHERE owner_id = $u OR EXISTS (…access policies…)` clause — the
attack surface multiplies by the number of endpoints. Each one
becomes:
- a place where a developer can drop a Deny check by accident,
- a place where the predicate diverges from the canonical
  `POLICY_SEMANTICS.md` rules,
- a target for "this list endpoint returns more rows than the
  per-resource GET allows" exploits,
- a separate set of tests to keep in sync.

A single primitive collapses all of that to one auditable function.
Bugs land in one place. Reviews look at one file. CI test
property-based behaviour against one API.

**Internal fast paths stay inside the primitive.** The OwnerOnly
optimisation (LISTING.md §4) is now an internal branch *within*
`list_visible` — when the engine recognises that
`scope = ScopeOwned AND subject is the requesting user`, it runs the
direct-table query inside the engine and returns the IDs. The caller
sees the same function signature regardless. The engine can also
recognise other shortcuts (Trusted-app + owner) without exposing
them.

**Defence in depth via Postgres RLS.** Every registered resource
table additionally carries a Row-Level Security policy that
re-implements the same `check_access` decision. The RLS policy is
slow (it has to evaluate per-row), but it does not need to be fast:
the primitive is the production code path, and RLS exists only to
catch the case where some new handler bypasses the primitive
entirely. A direct `SELECT … FROM files` from a handler that forgot
the primitive returns zero rows for non-allowed resources instead of
leaking them. The RLS predicate calls the same SQL function the
primitive uses, so the rules cannot drift.

**What we give up.** Custom hand-rolled queries that fuse auth with
service-specific filtering. If a service genuinely needs "give me
all files where mime_type starts with image/ AND the user can see
them", it does:
1. `list_visible(..., page_size = LARGE)` to get the visible IDs
   (or use a cursor),
2. local filter `WHERE id = ANY($1) AND mime_type LIKE 'image/%'`.

This is one extra round-trip in exchange for a one-function audit
surface. Worth it.

### 3.7 The listing problem is layered, owner-first, scale-aware

**Choice.** Listing is split into a `ListingPlan` enum with two
arms.

1. *OwnerOnly* — when the listing is scoped to a single owner (the
   common "my things" tab), the engine detects this internally and
   runs an indexed `WHERE owner_id = $u ORDER BY sort_key DESC LIMIT N`
   itself. Zero policy-table touches. The handler sees the same
   `list_visible(...)` signature as any other call and receives the
   same `Vec<(resource_id, sort_key)>` shape — **the handler never
   composes SQL**, per the single-primitive rule in §3.7a.
2. *AuthMediated* — a k-way sorted stream merge with keyset
   pagination. Each access source (Owned, Direct, ResourceGroup,
   Public, ServerMember, large-UserGroup, AccessibleByOwner) is one
   sorted cursor; a heap merges them; Deny is checked per candidate;
   the stream stops as soon as the page is full. No `UNION/EXCEPT`,
   no materialised allowed-set, no `count(*)`.

Two materialised *cover tables* — `public_resources`,
`server_member_resources`, and an opt-in
`user_group_accessible_resources` for groups above a cardinality
threshold — exist purely to make those *sources* page-cheap.
`AccessibleByOwner` is *not* materialised; the engine recurses with
the bounded depth from POLICY_SEMANTICS.md §4.

**Why.** Two facts dominate the design:

- **Most resources are owned by the user listing them**, so the
  hottest query must skip the auth engine entirely.
- At target scale (10k users, 10M resources, 1M policies, 1M Public
  shares) any approach that materialises the full allowed-set per
  call breaks. Per-call cost must be `O(page_size × k_sources)`,
  not `O(allowed_set_size)`.

See LISTING.md for the complete algorithm, worst-case analysis per
scenario, and the trigger surface for the covers.

### 3.8 Authentication stays in Zitadel; we sit on top

**Choice.** Zitadel handles login, MFA, OIDC issuance, IdP federation.
MOWS authorization receives the introspected token and turns it into a
local `users` row keyed by `external_user_id`. Authorization decisions
never call back into Zitadel.

**Why.** Two reasons:
- Latency: an introspection round-trip per authorization check would blow
  every list endpoint. Introspection happens once per request in the
  authentication middleware (filez does this already).
- Authority of truth: Zitadel does not know about MOWS resources. Storing
  permissions in Zitadel would tie us to one IdP and limit policy
  expressivity to whatever Zitadel projects/roles permit.

## 4. Alternatives considered

### 4.1 Google Zanzibar / SpiceDB

A full Relationship-Based-Access-Control engine. Strong consistency,
caveats, expressive schemas, well-trodden.

**Rejected because:**
- Operational footprint (a separate stateful service with its own storage)
  is too high for the home/private-cluster target.
- The single-tenant nature of a MOWS cluster doesn't need cross-tenant
  isolation guarantees.
- Encoding "context app" relationships in Zanzibar is awkward — every
  `(user, resource)` tuple grows by a factor of `|apps|`.
- We already have a working engine in filez; adopting SpiceDB means
  rewriting the consumers and migrating data, with no clear gain.

We may revisit if MOWS grows multi-cluster federation. Today it's a no.

### 4.2 OPA / Rego

A general policy language we'd embed.

**Rejected because:**
- Listing through Rego is the same problem we have now, only harder
  (Rego has to be partial-evaluated against the database).
- Adds a Wasm runtime to every service.
- The UX target is "share this with X" buttons, not policy authoring; a
  DSL is the wrong shape.

### 4.3 AWS IAM-style JSON policy documents

JSON documents per principal, evaluated at request time.

**Rejected because:**
- Listing requires scanning every document; we'd reinvent the indices in
  application code. Storing the documents in Postgres and querying by JSON
  path is slow and brittle.
- The expressivity is overkill for the IDEA.md primitives.

### 4.4 Status quo (filez engine, copy-paste per service)

Cheap in the short term.

**Rejected because:** every new MOWS service would re-derive the same five
months of bug fixes. We already paid the design cost; we should harvest it.

## 5. Boundaries with other systems

| System              | Owns                                | We consume                          |
| ------------------- | ----------------------------------- | ----------------------------------- |
| Zitadel             | identity, login, MFA, IdP fed.      | OIDC introspection result           |
| Postgres (per svc)  | the authoritative resource tables   | their owner & membership columns    |
| `mows-auth-core`    | policy schema, evaluator, listing   | resource type registry from svcs    |
| Each MOWS service   | resource types, actions, handlers   | `is_allowed()` & `list_allowed()`   |
| Vault (optional)    | per-app secrets (e.g. signing keys) | nothing in the auth hot path        |

The hot path: HTTP request → service auth middleware → Zitadel introspection
(cached) → load `FilezUser` / `MowsApp` → call `mows-auth-core::check(...)`
→ proceed or 403. No external calls from `check()`; everything is in the
service's own Postgres.

## 6. Success criteria

- A new MOWS service can adopt the engine by:
  1. depending on `mows-auth-core`,
  2. registering its resource types & actions,
  3. emitting the standard migration that adds the shared tables
     (`apps`, `users`, `user_groups`, …) or aliasing to an existing
     instance,
  4. calling `check(...)` from handlers and `list_allowed(...)` from list
     endpoints.

  No new policy-engine code required for the common case.

- The single-resource check is a single Postgres round-trip (1 SELECT with
  predicate folding) for the *unowned, non-trusted-app, no-deny* case, and
  at worst three round-trips when group memberships exist. This is the
  current filez behaviour; we preserve it.

- The list endpoint scales to 10k users × 10M resources × 6.7M policies on
  a single Postgres node — **validated end-to-end in
  `.plans/authorization/experiments/`** with the following measured
  numbers (target = 10k users, 10M files, 1M Public, 5M ServerMember,
  6.78M policies):

  | Primitive call                            | Measured at target |
  | ----------------------------------------- | ------------------:|
  | `list_visible(scope=Owned)`               | **0.21 ms**        |
  | `list_visible(scope=All)` authenticated   | **3.2 ms**         |
  | `list_visible(scope=All)` anonymous       | **0.66 ms**        |
  | `check_access` per-resource               | **0.17–0.84 ms**   |
  | Pathological (member of 5k-user group)    | **21 ms**          |
  | Page 10 of cursor walk                    | **1.17 ms**        |
  | RLS bypass (direct query) — same data     | 302 s (5 min)      |
  | Mixed-workload throughput (70/20/10)      | **252 ops/sec**    |

  Owner-only path is `O(page_size)` index scan with no policy-table
  touch; the auth-mediated merge is `O(page_size × k_sources)` with
  bounded `k`. Materialised covers for Public / ServerMember / large
  groups remove the only sources whose cardinality scales with the
  global share count. The naive `UNION + EXCEPT` approach measures
  **31.6 seconds** per query at the same scale, confirming the
  rejection in LISTING.md §2.

- A user with `SuperAdmin` user-type can always read every resource via the
  manager UI (today's `trusted` + `SuperAdmin` shortcut, made explicit).

- A change to a policy is visible on the next request — no caching
  invalidation gymnastics in v1. (Caching is in OPEN_QUESTIONS.md.)
