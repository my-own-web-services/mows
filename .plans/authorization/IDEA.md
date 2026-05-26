# MOWS Authorization — Requirements

The cluster-wide system that decides "may principal P perform action A
on resource R via app C?" — once per request, fast enough not to
matter, and the same way for every MOWS service that ever exists.

## Primitives

| Primitive       | What it is                                                              |
| --------------- | ----------------------------------------------------------------------- |
| **User**        | A human authenticated through OIDC (Zitadel). Examples: Admin, Paul.    |
| **UserGroup**   | A named set of users. Owned by one user. Membership joins users to it.  |
| **Resource**    | Any addressable thing a service exposes — file, file_group, DNS zone, … |
| **ResourceGroup** | A named set of resources (e.g. file_group). Owned by one user.        |
| **App**         | A frontend SPA, a backend daemon, or another MOWS API that acts on a   |
|                 | user's behalf. Identified by its Zitadel OIDC `client_id` (see         |
|                 | AUTHENTICATION.md). Each app has exactly one Zitadel principal.        |

## Subjects of a share

A share's audience — *who* may use it — is exactly one of:

1. **User** — a specific named user
2. **UserGroup** — every current member of the group
3. **ServerMember** — anyone with an account on this MOWS cluster
4. **Public** — anyone, including unauthenticated visitors

## Self-owned sharing patterns

A user grants their own apps access to their own resources. The user
remains in control; revoke = delete one row.

| Pattern                                              | Example                                       |
| ---------------------------------------------------- | --------------------------------------------- |
| App may use *one* of my resources                    | Photos app may open this one image            |
| App may use *every resource in a group I own*        | Photos app may open my "Holiday 2025" folder  |
| App may use *all resources of one type I own*        | Backup app may read every file I own          |
| App may use *every resource I can see*               | Chat app may attach anything I have access to |

## Shared (other-user) sharing patterns

A user grants another principal access to a resource they own.

| Pattern                                                  |
| -------------------------------------------------------- |
| Share resource R with user V — via specific app, list of apps, or any app |
| Share resource R with user-group G — same app axis        |
| Share resource R with every ServerMember                  |
| Share resource R with the public (incl. anonymous)        |

## App access without a user account

An app may access a resource even when no user is logged in, *if* the
user explicitly pre-authorised that app for that resource. Concretely:
a `Public` share scoped to a specific app and action lets that app
read the resource on its own.

## Third-party-app consent flow (OAuth-style + Resource Picker)

A third-party frontend app (e.g. a music player SPA using filez)
must obtain the user's explicit consent before it can access any of
the user's resources. The flow is OAuth-shaped — the user is
prompted "this app wants to access X" — with one key addition: the
user **picks the specific resource** in the same UI as the consent.

- The third-party app embeds a first-party **MOWS Picker** iframe
  via a small JS SDK, describing what it needs ("a `FileGroup` I
  can read; here's why").
- The Picker shows the user's owned + shared resources of that
  type, the user selects one (or many), then confirms.
- On approval, the Picker creates one `access_policies` row
  (`subject = User(me), context_app_ids = [the-app],
  resource_id = picked, scope = Single, …`) — a standing grant.
- "Allow once" sets `expires_at = now() + 1h`; the engine filters
  expired policies automatically.
- The app then calls the service backend normally; the engine sees
  the new policy and allows the call.
- Revocation is a single-row update; "revoke this app entirely" is
  one UPDATE matching `context_app_ids @> ARRAY[<app_id>]`.

The picker IS the consent screen — there is no separate "approve
these scopes" step where the user might wave through "access to all
your files". Broad grants (`OwnedByOwner`, `AccessibleByOwner`) are
**deliberately not** offered to third-party apps via the consent
flow — those exist for the manager UI's explicit "App access" panel
only.

Full design: `CONSENT_FLOW.md`.

## Backend apps with no browser session

A backend service (backup daemon, indexer, sync worker, ML job,
webhook receiver) cannot run the Picker — there's no browser
attached. Three modes cover the cases:

- **On-behalf-of** *(the dominant pattern)*. User authorises the
  backend via the same Picker, then the backend sends both its
  Kubernetes service-account token (proving *which backend*) and
  an `X-Mows-On-Behalf-Of` header (claiming *which user*). The
  engine accepts the impersonation only if the policy table
  contains at least one active policy authorising that backend for
  that user. The policy's existence IS the authorisation. No
  bearer tokens. Revocation is one UPDATE.
- **Self-action**. Backend acts as itself (no user) — match against
  `Public`/`ServerMember` policies. Used by public-content indexers
  and admin-blessed system tasks.
- **Job-pickup** *(already exists)*. Backend processes discrete
  Jobs queued by users; the engine sets `requesting_user =
  job.owner_id` for the duration of processing.

Bootstrapping a fresh backend (first user) uses an OAuth-style
invite URL the backend generates → user opens in browser → standard
Picker → on approve, Picker calls back / backend polls. Same Picker,
same row shape, same engine.

Full design: `BACKEND_APPS.md`.

## UserGroup lifecycle

Two orthogonal axes per group:

- **Visibility**: `Private` (only members), `ListedRestricted` (visible
  in directories, not joinable directly), `Public` (visible to all).
- **Join policy**: `InviteOnly`, `RequestToJoin`, `OpenJoin`.

The "listed-restricted" group from the original sketch is the
combination `(ListedRestricted, RequestToJoin)`.

## Effects and precedence

Each policy has effect = **Allow** or **Deny**. Default is deny. A
matching Deny always defeats matching Allows — this lets a broad
share be selectively retracted ("the team can read everything in this
folder except this one file").

## Time-bounded and revocable

Every policy supports:
- `expires_at` (auto-expiry, soft — engine filters)
- `revoked` flag (soft delete; preserves audit trail)
- App-wide bulk revoke ("undo every share I ever gave to App X")

## Usage limits (per-policy quotas — service-specific)

Authorization answers *may you?*. Usage limits answer *how much
and how many?* — and that's a **per-service** question. Files have
bytes; a future calendar has events-per-day; a future mail service
has messages-per-month; DNS zones have records-per-zone. The auth
engine must not bake any one of these into its core; otherwise the
"generic engine" becomes "filez's engine in disguise".

The split:

- The **engine** (`mows-auth-core`) keeps `access_policies` clean —
  no quota columns, no byte counters. It exposes (a) the
  `via_policy_id` of each Allow decision and (b) a small `trait
  PolicyServiceExtension` with three hooks
  (`consent_ui_schema`, `on_policy_created`, `on_policy_revoked`).
- Each **service** (filez first; calendar / mail / DNS later)
  owns a side table keyed by `policy_id`, registers an extension
  describing the consent-UI fields users see, and enforces its own
  caps in the create / update flow.

Concretely for filez, the two motivating cases below become filez
features sitting next to the engine, not in it:

- **Anonymous upload link with a budget** → filez consent fragment
  asks for bytes / files / per-file caps. Picker commits the engine
  row + the `filez_policy_quotas` row in one transaction. Anonymous
  uploader uses the URL → filez's atomic reserve-and-commit flow
  enforces caps; storage_location quota is also checked. Hitting
  the cap returns `PolicyByteQuotaExceeded`.
- **Backend writer with a budget** → user authorises a backend the
  same way; filez extension shows backend-appropriate defaults
  (e.g. 50 GB / 10,000 files / 500 MB per file). Backend uses
  on-behalf-of (per `BACKEND_APPS.md`); filez enforces the cap on
  every create.

Anti-abuse ceilings (e.g. *no single user may offer more than
10 TB total across their live policies*) live in **filez's
config**, enforced inside filez's `on_policy_created`. A future
service with its own units sets its own ceilings the same way.

**Cross-API bundles.** A single Picker consent can span multiple
services — e.g. a Gaussian-splatting viewer that needs filez
storage + AI compute + realtime bandwidth gets all three on one
screen, committed in one transaction, revocable as one row.
Achieved with a single nullable `policy_bundle_id` column on
`access_policies` — opaque to the engine, used only by the
share-management UI and bulk revoke. Each service's quota stays in
its own side table; no cluster-wide "credit" unit.

Full design: `USAGE_LIMITS.md`.

## Deployment — separate, but blazingly fast

The auth system is **operationally separate** (its own repo, its
own pod for the Picker, its own DB role) without paying a network
hop on the hot path. The trick: shared Postgres instance with
separate schemas.

- `mows_auth` schema — owned by the auth-service repo: policies,
  subjects, apps, group lifecycle, cover tables, helper PL/pgSQL.
- Each service schema (`filez`, `pektin`, …) — owned by the
  service's repo: its resources + its own per-service
  `check_access` / `list_visible` PL/pgSQL functions generated
  from templates in the `mows-auth-core` Rust crate. These
  functions cross-schema-JOIN to `mows_auth.access_policies`
  freely — same connection, same Postgres backend, zero overhead.
- Picker pod — the only DB role with INSERT on
  `mows_auth.access_policies`. Service roles get SELECT only.
  Postgres enforces this at the role level, on top of the
  application-level rule and the RLS defence layer.
- A separate microservice for `check_access` was rejected: a
  network hop adds ~1 ms on loopback, 5–10 ms cross-node — kills
  the SLO at k=50 candidates per page. In-process Rust + single
  Postgres query stays at the validated 3 ms p99.

Full design: `DEPLOYMENT.md`.

## Hard requirements

1. **Single API surface per service.** Two functions exposed by the
   shared engine — `check_access(...)` and `list_visible(...)`. No
   handler writes its own auth SQL. Defence in depth via Postgres RLS
   calling the same function so rules cannot drift.
2. **Sub-25 ms p99** for every list call at target scale (10k users,
   10M resources, 1M Public shares, 6.78M policies). Owner-only path
   sub-millisecond. Validated in `experiments/`.
3. **Scale invariance.** Adding more data must not slow the hot
   path. Cover tables (Public, ServerMember, large UserGroups) and
   keyset pagination guarantee `O(page_size)` listings.
4. **Audit reasons.** Every decision returns a typed reason
   (`Owned`, `AllowedByDirectUserPolicy{policy_id}`,
   `DeniedByResourceGroupUserGroupPolicy{…}`, …) so the audit log
   and the "why was I denied?" UI never have to guess.
5. **Infinite-scroll-friendly.** Keyset cursors throughout. Page N
   costs the same as page 1.
6. **One implementation per service is enough.** Filez is the first
   consumer; the engine extracts into `mows-auth-core` so the
   second service (Pektin, manager UI, …) adopts it without
   re-deriving five months of bug fixes.

## The hard question (and the answer)

> *Is user A allowed to read R via app C?* is easy.
> *What can user A see via app C?* is difficult.

Resolved by:
- A direct **owner-only fast path** for "list my own things" (no
  policy table touched).
- A **k-way sorted stream merge** with keyset pagination for the
  combined "everything I see" view, each source bounded by
  `page_size`.
- **Materialised cover tables** for the three sources whose
  cardinality scales with the global share count (Public,
  ServerMember, large UserGroups).
- **No `UNION + EXCEPT` materialisation** of the full allowed set —
  measured 31.6 seconds per page at target scale; rejected.

Full design: `ARCHITECTURE.md` (rationale), `DATA_MODEL.md` (schema),
`POLICY_SEMANTICS.md` (evaluation algorithm), `LISTING.md`
(scale-aware listing), `USER_GROUPS.md` (lifecycle),
`AUTHENTICATION.md` (Zitadel as the only token issuer; one Zitadel
principal per API and per app; request shapes; realtime API worked
example), `APP_AUTHORIZATION.md` (apps as context), `CONSENT_FLOW.md`
(Picker + SDK for third-party SPAs), `BACKEND_APPS.md` (on-behalf-of
for non-browser apps), `USAGE_LIMITS.md` (per-service per-policy
quotas), `DEPLOYMENT.md` (shared-Postgres separate-schema topology
that gives separation without the network hop), `OPEN_QUESTIONS.md`
(decisions still to make), `ROADMAP.md` (phased implementation),
`PLAN.md` (status board), `experiments/` (live SQL validation at
4 scales).

## Out of scope (v1)

- Federation across MOWS clusters
- Attribute-based or DSL-driven policies (Rego, Cedar, AWS IAM JSON)
- Free-text search joined with auth (sits in the search index, not here)
- Cross-resource-type combined listings (each type runs its own
  primitive in parallel; frontend interleaves)
- Cryptographic per-link capability tokens (v2; expires_at covers
  the auto-expire case)
