# DEPLOYMENT — Separation without the network hop

The auth system must look and feel **separate from filez** —
separate repo, separate ownership, separate schema, separate
deployment of the Picker UI. But listing has to stay
**sub-10 ms p99** (per the experiments). A separate microservice
that filez calls over the network would either add a network
round-trip per check (kills the SLO) or duplicate filez's data
into the auth service (defeats the point of separation).

The resolution: **shared Postgres instance, separate schemas, an
in-process Rust library that emits cross-schema SQL**. The auth
service exists logically and operationally; physically the hot
path stays a single Postgres query.

## The topology

```
┌──────────────────────────────────────────────────────────────────┐
│  Kubernetes namespace: mows-core-auth                            │
│                                                                  │
│   ┌──────────────┐     ┌─────────────────┐                       │
│   │  picker-ui   │     │  picker-backend │                       │
│   │  (SPA pod)   │     │  (Axum service) │                       │
│   └──────────────┘     └────────┬────────┘                       │
│                                 │ writes / reads access_policies │
│                                 ▼                                │
└──────────────────────────────────┼───────────────────────────────┘
                                   │
                                   │
┌──────────────────────────────────┼───────────────────────────────┐
│   shared Postgres instance       │                               │
│                                  ▼                               │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │  schema: mows_auth                                          │ │
│   │    access_policies, users, apps, user_groups,               │ │
│   │    user_user_group_members,                                 │ │
│   │    public_resources cover, server_member_resources cover,   │ │
│   │    user_group_accessible_resources cover,                   │ │
│   │    PL/pgSQL: auth_user_group_ids(user_id), …               │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │  schema: filez                                              │ │
│   │    files, file_groups, file_file_group_members,             │ │
│   │    jobs, storage_quotas, filez_policy_quotas,               │ │
│   │    PL/pgSQL: filez_check_access(...), filez_list_visible(...)│
│   │      (cross-schema joins to mows_auth.access_policies)      │ │
│   └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│   ┌────────────────────────────────────────────────────────────┐ │
│   │  schema: pektin / calendar / future-service                 │ │
│   │    same pattern: own resources + own check/list functions   │ │
│   └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ each service pod connects to its
                                  │ own schema + has SELECT on mows_auth
┌─────────────────────────────────┼────────────────────────────────┐
│   service pods (filez-server, …)                                 │
│   ┌──────────────────┐                                           │
│   │  filez-server    │  in-process: mows-auth-core crate         │
│   │  (Axum service)  │  calls `filez_list_visible(...)`          │
│   │                  │  via diesel, one Postgres round-trip      │
│   └──────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
```

Three things are physically separate:
- **the auth-service repo / pod** (Picker UI + the small backend that
  serves it + the schema migrations for `mows_auth`),
- **each service repo / pod** (filez, pektin, …) with its own
  schema and migrations,
- **the Rust crate `mows-auth-core`** distributed via Cargo, used
  by every service to call its own per-service `check_access` /
  `list_visible` functions.

One thing is physically shared: the **Postgres instance**. This is
the trick. Cross-schema JOIN in Postgres is zero-cost — same
connection, same buffer pool, same plan cache. A service query
that reaches into `mows_auth.access_policies` runs at the same
speed as one that only touches the service's own tables.

## Why not a separate microservice for `check_access`?

Measured: in-process call returns in 0.17–3.2 ms at target scale.
A network round-trip to a sidecar (gRPC unary) adds **~1 ms even
on the same host** (loopback) and **5–10 ms cross-node**.
Multiplying that by the listing's k-way merge (one check per
candidate, ~50 candidates per page) puts a page at 50–500 ms.
That's the entire SLO budget, gone.

Worse, a separate microservice cannot do cross-schema JOIN. It
would either have to:
- ask the service for the candidate IDs, then ask the service
  again for the Deny check (two extra round-trips, more latency),
  or
- maintain its own replica of the service's resource tables (a
  whole stream-replication system, with consistency-lag bugs).

Neither is acceptable. In-process Rust over a single Postgres
connection is the only design that meets the SLO.

## Why not a separate Postgres per service?

Postgres has no "fast cross-database JOIN" — `dblink` and
foreign-data-wrappers add roughly the same overhead as a network
call. A separate-DB design forces either:
- per-service auth-data replication (back to the consistency-lag
  problem), or
- the auth engine accepts pre-filtered ID lists from the service
  and just answers yes/no (back to the multi-round-trip problem).

For a single-cluster MOWS deployment, **one Postgres instance
shared across services** is the right call. If a service ever has
to scale out to its own dedicated Postgres (filez might, for raw
storage growth), it can be done with logical replication of the
`mows_auth` tables it needs to read — but that's a v2 concern, not
v1.

## What lives in `mows_auth` and what does each service own

### `mows_auth` schema (owned by the auth-service repo)

Service-agnostic. No knowledge of files, calendars, or DNS zones.

| Table / function                          | Notes                                                              |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `access_policies`                         | The one canonical policy table                                     |
| `users`, `apps`                           | Identity & app registry                                            |
| `user_groups`, `user_user_group_members`  | Group lifecycle                                                    |
| `user_user_group_invitations`             | Pending invites                                                    |
| `user_user_group_join_requests`           | Pending requests                                                   |
| `public_resources`                        | Generic cover keyed by `(resource_type, resource_id)`              |
| `server_member_resources`                 | Generic cover                                                      |
| `user_group_accessible_resources`         | Generic cover per `(user_group_id, resource_type, resource_id)`    |
| `auth_user_group_ids(user_id)` PL/pgSQL  | Helper used by per-service functions                               |

Resource-type integers come from a partitioned space documented in
the auth crate (filez = 0–999, pektin = 1000–1999, etc.) so a
single `(resource_type, resource_id)` cover row is unambiguous.

### Per-service schema (owned by each service repo)

For example, `filez`:

| Table / function                                  | Notes                                                     |
| ------------------------------------------------- | --------------------------------------------------------- |
| `files`, `file_groups`, `file_file_group_members` | The resource tables                                       |
| `jobs`, `storage_quotas`, `filez_policy_quotas`   | filez-specific accounting                                 |
| `filez_check_access(user, app, file_id, action)`  | PL/pgSQL: cross-schema joins to `mows_auth.access_policies` |
| `filez_list_visible(user, app, action, scope, …)` | PL/pgSQL: the k-way merge using filez's tables + auth covers |

These per-service functions are **generated from templates in the
`mows-auth-core` crate**, parameterised by the service's resource
schema (table name, owner column, group membership table, sort
columns). Generation happens at build time — a `build.rs` step in
each service emits the per-service SQL into a migration file. No
runtime templating, no `EXECUTE format` cost for the structure
(the cost is still paid for parameter inlining — see LISTING.md
§3b — but only the values are dynamic).

## Where the Picker fits

The Picker is its own small Axum + SPA pod in `mows-core-auth`.
It does three things:
- Renders the consent UI (the SPA).
- Reads `mows_auth.access_policies` + service-provided consent
  schemas to display "what's being granted" in plain words.
- Writes new policy rows on user approval, calling
  `service_extension.on_policy_created(...)` (per
  USAGE_LIMITS.md) inside the same Postgres transaction. The
  service's extension hook runs as a callback in the Picker's
  connection.

The Picker's transactions cross schemas the same way listing
queries do — one connection, multiple `INSERT`s into different
schemas, single COMMIT.

## DB roles — enforced separation

Application-level discipline plus role-level enforcement. Each
service gets its own Postgres role with the minimum grants:

```sql
-- The Picker — minimum privilege. NOT a blanket grant on mows_auth: a
-- compromised Picker with full write on mows_auth.users could self-promote
-- (UPDATE users SET user_type = 0). It needs only:
GRANT USAGE  ON SCHEMA mows_auth, filez TO picker_role;

GRANT SELECT
    ON  mows_auth.users, mows_auth.apps,
        mows_auth.user_groups, mows_auth.user_user_group_members
    TO  picker_role;

-- The Picker writes access_policies and updates them (e.g. to set
-- `revoked = TRUE`). It does NOT delete — soft delete preserves audit.
GRANT SELECT, INSERT, UPDATE ON mows_auth.access_policies TO picker_role;
REVOKE DELETE ON mows_auth.access_policies FROM picker_role;

-- The Picker also writes per-service side tables in the same
-- transaction as the policy (USAGE_LIMITS.md atomic two-row commit).
GRANT SELECT, INSERT, UPDATE, DELETE ON filez.filez_policy_quotas TO picker_role;

-- A service like filez — read mows_auth, full access to its own schema.
GRANT USAGE  ON SCHEMA mows_auth, filez TO filez_role;
GRANT SELECT ON ALL TABLES IN SCHEMA mows_auth TO filez_role;

-- Explicit REVOKE locks down the separation actively, not passively.
-- A future blanket `GRANT ALL ... TO filez_role` in a migration would
-- otherwise silently elevate the role.
REVOKE INSERT, UPDATE, DELETE
    ON mows_auth.access_policies,
       mows_auth.users, mows_auth.apps,
       mows_auth.user_groups, mows_auth.user_user_group_members
    FROM filez_role;

-- The cover tables are maintained by the service's own triggers, so
-- filez_role does need write access there.
GRANT INSERT, UPDATE, DELETE ON
    mows_auth.public_resources,
    mows_auth.server_member_resources,
    mows_auth.user_group_accessible_resources
    TO filez_role;

GRANT ALL ON ALL TABLES IN SCHEMA filez TO filez_role;

-- Default privileges: future tables added to mows_auth inherit the
-- right posture automatically — filez_role gets SELECT only.
ALTER DEFAULT PRIVILEGES IN SCHEMA mows_auth
    GRANT SELECT ON TABLES TO filez_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mows_auth
    REVOKE INSERT, UPDATE, DELETE ON TABLES FROM filez_role;
```

If a buggy filez handler somehow tries `INSERT INTO
mows_auth.access_policies`, the database itself rejects the
attempt. The Picker is the only writer of authorisation rows.
This is **stronger than application-code discipline** — even a
compromised filez can't elevate its own permissions.

RLS (already in the design) is the third layer of defence: even
SELECT is filtered if a handler bypasses the primitive.

## Migration ordering

Migrations run in dependency order:

1. `mows_auth` schema migrations first — owned by the auth-service
   repo, applied on cluster install before any service deploys.
2. Each service's migrations second — they can `REFERENCES`
   `mows_auth.users(id)` etc. directly.
3. Cover triggers in each service's migrations — they create
   functions that maintain the generic cover tables based on
   writes to that service's resource tables.

Diesel / sqlx tooling supports cross-schema FKs natively. Each
service's migrations live in that service's repo; the cluster's
mows-package-manager applies them in the right order based on
declared dependencies.

## What this gets us

- **Speed**: the experiments validated 0.17–3.2 ms p99 at target
  scale with this exact shape — in-process Rust → single Postgres
  call → cross-schema query.
- **Separation in the dimensions that matter**:
  - Repos: auth crate + Picker live in their own repo, owned by
    the auth team.
  - Deployment: the Picker is a separate pod (own version, own
    rollout schedule).
  - Schema: `mows_auth.*` migrations are versioned and rolled out
    independently of any service.
  - DB roles: a service that tries to write auth tables is
    rejected by Postgres before its query touches a row.
  - RLS: even SELECT is gated for raw-table queries.
- **No new operational surface**: one Postgres to manage. The
  auth crate is just a dependency in each service's `Cargo.toml`.

## What this does NOT solve

- **Multiple physically separate Postgres instances** (e.g.,
  per-region filez vs central auth) — would need logical
  replication of `mows_auth` to each region, or accept network
  hop. Out of scope for v1.
- **Other-language services** — a Python or Go service can't link
  the Rust crate. It would have to call the per-service PL/pgSQL
  functions directly via its own DB driver (still in-process to
  Postgres), or pay the network hop to a sidecar. We don't have
  non-Rust MOWS services, so this is theoretical.
- **Hot-standby for the auth schema** — Postgres streaming
  replicas give us read-only standby for free if we deploy them;
  failover is the same as for any Postgres-backed service.

## Net effect

The auth service is logically separate, operationally separate
(own repo, own pod for the Picker, own migrations), and
permission-separate (DB roles + RLS) — but the hot path of
`list_visible` and `check_access` is a single Postgres query in
the service's own connection. Filez lists stay at 3 ms p99 at
10M-row scale, exactly because the auth queries happen *inside*
filez's own Postgres connection rather than across a network. The
"shared instance, separate schema" pattern is what makes
"separate without sacrificing speed" possible.

## Decision summary

| Question                                          | Answer                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| Embedded crate vs sidecar microservice?           | **Crate**, in-process with the service             |
| One Postgres or many?                             | **One**, with separate schemas per service          |
| Where do per-service `list_visible` functions live?| In the service's schema, generated by the crate    |
| Who can INSERT into `mows_auth.access_policies`?  | **Only the Picker pod's DB role**                   |
| Who calls `check_access` at runtime?              | The service's handler, via the crate, via PL/pgSQL  |
| Why is filez listing blazing fast?                | Cross-schema queries in one connection — zero hops  |
