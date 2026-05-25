# DATA_MODEL — MOWS Authorization

This document defines the tables, columns, indexes, and the shared crate
layout. Everything here either already exists in `apis/cloud/filez/server/`
or is a small additive change. Anything that is *new* is flagged with **NEW**.

## 1. Shared crate layout

```
utils/mows-auth-core/
├── Cargo.toml
├── src/
│   ├── lib.rs                # re-exports
│   ├── types.rs              # ids, enums (Subject, Effect, …)
│   ├── schema.rs             # diesel table! macros for shared tables
│   ├── migrations/           # diesel migrations for shared tables
│   ├── registry.rs           # ResourceTypeRegistry — how services plug in
│   ├── check.rs              # check_resources_access_control(...)
│   ├── list.rs               # list_allowed_ids(...)
│   ├── policies/
│   │   ├── mod.rs            # AccessPolicy struct + CRUD
│   │   └── filter_macros.rs  # filter_subject_access_policies! macro
│   ├── groups/
│   │   ├── users.rs          # UserGroup + memberships
│   │   └── resources.rs      # generic resource-group helpers
│   ├── subjects/
│   │   ├── user.rs           # FilezUser → MowsUser
│   │   └── app.rs            # MowsApp
│   └── tests/
└── README.md
```

**Naming.** `FilezUser` → `MowsUser`, `FilezUserId` → `MowsUserId`. Filez
keeps a type alias for backwards compatibility during migration. Same for
`FilezError` → service-specific `FilezError` *wraps* `mows_auth_core::Error`.

**Migrations.** Shared tables (`apps`, `users`, `user_groups`,
`user_user_group_members`, `access_policies`) ship as crate-bundled diesel
migrations consumed by each service's `diesel migration run`. Each service
also runs its *own* migrations for its resource tables.

**Why a crate not a microservice.** A microservice would force a network
hop on every `check(...)`. Filez's hot path is one Postgres query; we will
not give that up.

## 2. Shared tables

### 2.1 `users`

Already exists in filez. Generalisation: rename type to `MowsUser`,
otherwise unchanged.

```sql
CREATE TABLE users (
    id                    UUID PRIMARY KEY,
    external_user_id      TEXT UNIQUE,
    pre_identifier_email  TEXT UNIQUE,
    display_name          TEXT NOT NULL DEFAULT '',
    created_time          TIMESTAMP NOT NULL,
    modified_time         TIMESTAMP NOT NULL,
    deleted               BOOL NOT NULL DEFAULT FALSE,
    profile_picture       UUID NULL,                -- service-specific FK
    created_by            UUID NULL REFERENCES users(id),
    user_type             SMALLINT NOT NULL         -- 0 SuperAdmin, 1 Regular, 2 KeyAccess
);
CREATE INDEX users_external_user_id_idx ON users(external_user_id);
CREATE INDEX users_pre_identifier_email_idx ON users(pre_identifier_email);
```

`profile_picture` is intentionally `UUID NULL` with no FK; the shared crate
must not reference filez-specific tables. Each service that wants to store
a profile picture defines its own join via a separate table or treats the
column as opaque.

### 2.2 `apps`

Already exists in filez. Generalisation: unchanged.

```sql
CREATE TABLE apps (
    id              UUID PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    origins         TEXT[] NULL,
    trusted         BOOL NOT NULL DEFAULT FALSE,
    description     TEXT NULL,
    created_time    TIMESTAMP NOT NULL,
    modified_time   TIMESTAMP NOT NULL,
    app_type        SMALLINT NOT NULL              -- 0 Frontend, 1 Backend
);
CREATE INDEX apps_origins_gin_idx ON apps USING GIN (origins);
```

`trusted` is admin-only. The first-party UI and the manager UI get `trusted
= TRUE`. Third-party apps default to `FALSE`. The trust path is described
in ARCHITECTURE.md §3.4.

### 2.3 `user_groups` and `user_user_group_members`

Already exist in filez. **NEW columns** on `user_groups` for the lifecycle
semantics from IDEA.md §UserGroups:

```sql
ALTER TABLE user_groups
    ADD COLUMN visibility      SMALLINT NOT NULL DEFAULT 0,  -- 0 Private, 1 ListedRestricted, 2 Public
    ADD COLUMN join_policy     SMALLINT NOT NULL DEFAULT 0,  -- 0 InviteOnly, 1 RequestToJoin, 2 OpenJoin
    ADD COLUMN description     TEXT NULL;
```

**NEW table** for membership requests:

```sql
CREATE TABLE user_user_group_join_requests (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_group_id  UUID NOT NULL REFERENCES user_groups(id) ON DELETE CASCADE,
    requested_time TIMESTAMP NOT NULL,
    message        TEXT NULL,
    PRIMARY KEY (user_id, user_group_id)
);
```

See USER_GROUPS.md for how visibility × join_policy interact.

### 2.4 `access_policies`

Already exists in filez. **NEW columns** for the IDEA.md "self-owned /
shared" patterns:

```sql
CREATE TABLE access_policies (
    id                UUID PRIMARY KEY,
    owner_id          UUID NOT NULL REFERENCES users(id),
    name              TEXT NOT NULL,

    created_time      TIMESTAMP NOT NULL,
    modified_time     TIMESTAMP NOT NULL,

    subject_type      SMALLINT NOT NULL,   -- 0 User, 1 UserGroup, 2 ServerMember, 3 Public
    subject_id        UUID NOT NULL,       -- nil UUID for ServerMember/Public

    context_app_ids   UUID[] NOT NULL,     -- empty = no app may use this policy
                                           -- (nil UUID = ANY app — see §3.3)

    -- FUTURE-2: resource_type and actions[] element type are INT, not
    -- SMALLINT. The Rust API uses u32. SMALLINT (signed 16-bit, max
    -- 32,767) would silently overflow at value 32768 — and the partition
    -- (filez=0–999, pektin=1000–1999, …) leaves no headroom as services
    -- proliferate. INT keeps the cost constant per row and removes
    -- the ceiling entirely.
    resource_type     INT NOT NULL,
    resource_id       UUID NULL,           -- NULL = type-level policy
    resource_scope    SMALLINT NOT NULL DEFAULT 0,  -- 0 Single, 1 OwnedByOwner, 2 AccessibleByOwner  -- NEW
                                                    -- see POLICY_SEMANTICS.md §4

    actions           INT[] NOT NULL,
    effect            SMALLINT NOT NULL,   -- 0 Deny, 1 Allow

    expires_at        TIMESTAMP NULL,      -- NEW: time-bounded shares
    revoked           BOOL NOT NULL DEFAULT FALSE  -- NEW: soft delete for audit
);

CREATE INDEX ap_lookup_idx
    ON access_policies (resource_type, resource_id, subject_type, subject_id)
    WHERE NOT revoked;

CREATE INDEX ap_subject_idx
    ON access_policies (subject_type, subject_id, resource_type)
    WHERE NOT revoked;

CREATE INDEX ap_context_apps_gin
    ON access_policies USING GIN (context_app_ids);

CREATE INDEX ap_actions_gin
    ON access_policies USING GIN (actions);
```

The two new B-tree indexes are tuned for the two access patterns we have:
the *point check* (resource-first lookup) and the *listing* (subject-first
lookup). The two GIN indexes accelerate the contains-array filters.

In addition to `access_policies` indexes, **each registered resource table
must expose sort-key indexes** that the listing engine uses for keyset
pagination. The standard set per resource table (from LISTING.md §11):

```sql
CREATE INDEX {table}_owner_created_id_idx ON {table} (owner_id, created_time DESC, id DESC);
CREATE INDEX {table}_created_id_idx       ON {table} (created_time DESC, id DESC);
CREATE INDEX {table}_modified_id_idx      ON {table} (modified_time DESC, id DESC);
-- and one per (group_id, resource_id) on each membership table
```

The `mows-auth-core` migration helpers generate these on the service's
behalf when the resource type is registered.

`resource_scope` is **NEW** and is the cleanest way to express IDEA.md's
"A user can allow an app to use all objects in a self-owned Group" / "all
of the objects they have access to":

- `Single` — the row's `resource_id` is the literal target. This is the
  current filez behaviour.
- `OwnedByOwner` — applies to *every* resource of `resource_type` whose
  `owner_id = access_policies.owner_id`. `resource_id` must be NULL.
- `AccessibleByOwner` — applies transitively to every resource of
  `resource_type` the owner has access to. `resource_id` must be NULL.
  The owner cannot escalate themselves, so this row only grants what is
  already granted to them, but channels it through one more `(subject,
  app)` pair. Use case: "the chat app can see anything I can see,
  forever".

These three scopes are evaluated by an OR-extension of the existing
predicate in `check_resources_access_control`. See POLICY_SEMANTICS.md §4.

## 3. Type registry — how a service plugs in

The filez file `models/access_policies/check.rs::get_auth_params_for_resource_type`
is the right shape but currently hard-codes every type. Generalised:

```rust
// in mows-auth-core::registry
pub struct ResourceAuthInfo {
    pub resource_table: &'static str,
    pub resource_table_id_column: &'static str,
    pub resource_table_owner_column: Option<&'static str>,
    pub resource_type: u32,                    // service-defined integer (FUTURE-2: u32, not u16)

    // For resources that can be members of resource groups:
    pub group_membership_table:               Option<&'static str>,
    pub group_membership_resource_id_column:  Option<&'static str>,
    pub group_membership_group_id_column:     Option<&'static str>,
    pub resource_group_type:                  Option<u16>,
}

pub trait ResourceTypeRegistry: Send + Sync {
    fn lookup(&self, resource_type: u16) -> Option<&ResourceAuthInfo>;
    fn all(&self) -> &[ResourceAuthInfo];
}
```

A service constructs its registry at startup and passes it to the engine:

```rust
let registry = StaticResourceTypeRegistry::new(vec![
    ResourceAuthInfo {
        resource_table:                       "files",
        resource_table_id_column:             "id",
        resource_table_owner_column:          Some("owner_id"),
        resource_type:                        FilezResourceType::File as u16,
        group_membership_table:               Some("file_file_group_members"),
        group_membership_resource_id_column:  Some("file_id"),
        group_membership_group_id_column:     Some("file_group_id"),
        resource_group_type:                  Some(FilezResourceType::FileGroup as u16),
    },
    // ...
]);
let engine = AuthEngine::new(registry, db_pool.clone());
```

The integer ranges are partitioned per service so we can mix services in
one cluster if we ever want to (see OPEN_QUESTIONS.md §"Resource-type
integer space").

**Safety.** Because the registry maps integers to *table names* used in
`format!()` SQL, the registry construction must validate that table /
column names match a strict identifier regex. We do this once at startup
and refuse to boot on a bad entry. This is the same trust model filez
already uses with its hardcoded values.

### 3.1 `nil` UUID for "any app"

Today filez stores the literal app id in `context_app_ids[]` and the
lookup uses `@>` (contains). To express "this policy applies to any app",
use the nil UUID (`00000000-0000-0000-0000-000000000000`) as a sentinel.
The check engine adds `OR context_app_ids @> ARRAY[nil_uuid]` to the WHERE
clause whenever evaluating a request. The check is cheap (GIN index) and
keeps the column NOT NULL with `[]` meaning "no app" (the explicit
*revoked* shape).

### 3.2 Compound subject ID type

Already done in filez via `impl_typed_compound_uuid!`. Generalise as
`SubjectId(Uuid)` with `From<UserId>` and `From<UserGroupId>`. The shared
crate provides the impl_typed_uuid! macros (already in filez utils).

## 4. Invariants enforced by triggers

1. `access_policies.context_app_ids` non-empty (use the nil UUID sentinel
   for "any app"; never store `[]`). DB-side `CHECK (cardinality(context_app_ids) > 0)`.
2. `access_policies.actions` non-empty. Same shape: `CHECK
   (cardinality(actions) > 0)`.
3. `(resource_scope, resource_id)` consistent:
   `CHECK (
       (resource_scope = 0 AND resource_id IS NOT NULL) OR
       (resource_scope IN (1, 2) AND resource_id IS NULL) OR
       (resource_id IS NULL AND resource_scope = 0)  -- type-level
   )`
4. `subject_type ∈ (2, 3)` ⇒ `subject_id = nil_uuid`. Trigger or
   partial-index check.
5. `expires_at IS NULL OR expires_at > created_time`.
6. Soft-deleted policies (`revoked = TRUE`) MUST NOT be returned by any
   check or listing query. The two main indexes use
   `WHERE NOT revoked` partial indexes (above) to keep this cheap.

## 4a. Listing cover tables (LISTING.md §6)

For scale (10k users × 10M resources × 1M Public shares) we maintain
three covering materialised tables keyed for keyset pagination:

```sql
CREATE TABLE public_resources (
    resource_type    SMALLINT NOT NULL,
    resource_id      UUID     NOT NULL,
    sort_created     TIMESTAMP NOT NULL,
    sort_modified    TIMESTAMP NOT NULL,
    sort_name        TEXT      NOT NULL,
    app_ids          UUID[]    NOT NULL,
    actions          SMALLINT[] NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
);
-- mirror: server_member_resources (same shape)
-- mirror: user_group_accessible_resources keyed by (user_group_id, …),
--         populated only for groups whose membership exceeds the
--         "large" threshold (default 1,000)
```

Each cover table carries per-row triggers as described in LISTING.md
§12. The covers replace what an earlier draft called
`listing_cache(subject, app, type, action) → resource_id` — that
shape would have been a combinatorial explosion at our scale; the
covers are scoped to the *exact* subject classes whose access
policies otherwise force a UNION-scan of the whole policy table.

`AccessibleByOwner` policies are **not** materialised. The earlier
sketched `accessible_by_owner_expansion(policy_id, resource_id)`
table would have been unbounded; instead the listing engine recurses
through the nested plan with bounded depth (POLICY_SEMANTICS.md §4,
LISTING.md §7).

## 5. Migration strategy (filez today → shared crate)

We can do this in three steps with zero downtime:

1. **Step A — extract the crate, no behaviour change.** Move
   `access_policies`, `users`, `user_groups`, `apps` modules into
   `utils/mows-auth-core/`. Filez depends on it. All filez tests pass
   unchanged. No schema migration yet.

2. **Step B — additive schema changes.** Apply the new columns and
   tables (visibility, join_policy, join_requests, resource_scope,
   expires_at, revoked, new indexes). All existing rows get safe
   defaults (visibility=Private, join_policy=InviteOnly,
   resource_scope=Single, expires_at=NULL, revoked=FALSE).
   Existing handlers keep working.

3. **Step C — expose the new behaviour.** Add HTTP endpoints to manage
   group lifecycle, expiring shares, and scope=OwnedByOwner /
   AccessibleByOwner policies. Build the manager-UI surfaces.

Each step is a separate PR with its own migration and tests.

## 6. Rust types — concrete sketch

```rust
// in mows-auth-core::types

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum SubjectType { User = 0, UserGroup = 1, ServerMember = 2, Public = 3 }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Effect { Deny = 0, Allow = 1 }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResourceScope { Single = 0, OwnedByOwner = 1, AccessibleByOwner = 2 }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GroupVisibility { Private = 0, ListedRestricted = 1, Public = 2 }

#[derive(Debug, Copy, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GroupJoinPolicy { InviteOnly = 0, RequestToJoin = 1, OpenJoin = 2 }

#[derive(thiserror::Error, Debug)]
pub enum AuthError {
    #[error("database: {0}")]
    Database(#[from] diesel::result::Error),
    #[error("pool: {0}")]
    Pool(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error("resource type {0} not registered")]
    UnknownResourceType(u16),
    #[error("auth evaluation: {0}")]
    Evaluation(String),
    #[error("access denied: {0}")]
    Denied(AuthResult),
    // …
}
```

Errors are scoped to the crate (per the CLAUDE.md preference). Services
wrap them in their own error type (filez's `FilezError` already does this).

## 7. What is *not* in the data model

- No "role" table. Roles in MOWS are admin-defined templates that expand
  into a set of access_policies at apply time. We do not store the
  template separately; the policies are the source of truth. (Optional
  future: a `policy_templates` table that helps UI but is not consulted
  on the hot path.)
- No "permission" table separate from `actions`. Actions are integers
  declared in code by each service.
- No transitive resource-group nesting. A file is in a file_group; a
  file_group is *not* in another file_group. If we ever need that, we
  add a closure table; today it's unnecessary complexity.
