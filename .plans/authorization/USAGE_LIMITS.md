# USAGE_LIMITS — Per-policy quotas (service-specific extension)

The auth engine answers *may you?*. **Usage limits answer "how much
and how many?", and that's a per-service question** — files have
bytes; calendars have events per day; mail has messages per month;
DNS zones have records per zone. The auth engine itself **stays
generic**: it does not know what a byte is, what a file is, or
what filez is.

This document defines the boundary:

- **Engine** (`mows-auth-core`) — stores `access_policies` rows.
  Decides Allow/Deny per `(subject, app, resource, action)`. Owns
  the Picker UI shell. Does **not** track usage. Does not have
  byte counters, file counters, or any other unit.
- **Each service** (filez today; calendar / mail / DNS tomorrow) —
  owns its own quota table keyed by `policy_id` (foreign key into
  `access_policies`). Implements its own atomic
  reserve-then-commit flow inside its create / update handlers.
  Plugs into the Picker via a small extension contract.

The two motivating cases (anonymous upload link, backend writer)
become **filez** features, not engine features. The shape of the
extension contract is what the engine commits to.

## What the engine adds for service-specific quotas

Two things only:

### 1. `via_policy_id` in `AuthResult`

`check_access(...)` already returns an `AuthReason` per evaluated
resource. We require that every Allow reason carries the
`policy_id` of the row that granted it (most variants already do —
`AllowedByDirectUserPolicy{policy_id}`, etc.). For Allow reasons
that don't reference a policy (`Owned`, `SuperAdmin`,
`TrustedAppOwned`), `via_policy_id` is `None` and the service's
quota layer knows "this was an owner-direct action — only the
service's owner-budget applies, no per-policy quota."

The service handler does:

```rust
let auth = engine.check_access(user, app, File, None, FilesCreate)?;
auth.verify()?;
let via = auth.via_policy_id();   // Option<PolicyId>
filez::quotas::reserve(via, file_size)?;
filez::storage::write(...)?;
filez::quotas::commit(via, file_id);
```

The engine never sees `file_size`.

### 2. A Picker extension contract

The Picker UI is a generic surface. When a user picks an action +
resource_type, the Picker asks **the service that owns that
resource_type** for an optional consent-UI fragment:

```rust
pub trait PolicyServiceExtension {
    fn consent_ui_schema(&self, action: ActionId) -> Option<ConsentUiSchema>;

    /// Called inside the transaction the Picker opens to create the
    /// engine's access_policies row. The service inserts its own
    /// side-table row in the same transaction, so a policy never
    /// exists without its quota.
    fn on_policy_created(
        &self,
        tx: &mut Transaction,
        policy_id: PolicyId,
        consent_values: serde_json::Value,
    ) -> Result<()>;

    /// Called when the engine soft-deletes a policy (revoked=true)
    /// or hard-deletes it. The service may free quota slots, log,
    /// or notify.
    fn on_policy_revoked(&self, policy_id: PolicyId) -> Result<()>;
}
```

`ConsentUiSchema` is a small JSON-Schema-like description: field
names, types, labels, defaults, validation. The Picker renders it
in the consent dialog above the standard Allow / Cancel buttons.
The user-entered values get passed back to
`on_policy_created` so the service stores them in its side table.

Services register their extension at startup, keyed by the
`(resource_type, action)` pairs they own. The engine maintains the
registry; the Picker consults it; the create transaction commits
both rows atomically.

This is the entire engine-side surface. Everything below is what
**filez** chooses to do with the contract.

## What filez does with the contract

filez registers an extension for `(File, FilesCreate)` and
`(File, FilesUpdate)`. The side table:

```sql
CREATE TABLE filez_policy_quotas (
    policy_id                 UUID PRIMARY KEY
                                  REFERENCES access_policies(id) ON DELETE CASCADE,
    max_bytes                 BIGINT NULL,
    max_files                 INT    NULL,
    max_per_file_bytes        BIGINT NULL,
    used_bytes                BIGINT NOT NULL DEFAULT 0,
    used_files                INT    NOT NULL DEFAULT 0,
    CHECK (max_bytes IS NULL OR max_bytes >= 0),
    CHECK (max_files IS NULL OR max_files >= 0),
    CHECK (max_per_file_bytes IS NULL OR max_per_file_bytes >= 0),
    CHECK (used_bytes >= 0 AND used_files >= 0)
);

ALTER TABLE files
    ADD COLUMN created_via_policy_id UUID NULL REFERENCES access_policies(id);
```

filez's consent_ui_schema for `FilesCreate`:

```jsonc
{
    "fields": [
        { "name": "max_bytes",          "label": "Total storage",   "type": "bytes", "default": "1GB"  },
        { "name": "max_files",          "label": "Max files",       "type": "int",   "default": 50     },
        { "name": "max_per_file_bytes", "label": "Per file size",   "type": "bytes", "default": "100MB"}
    ]
}
```

filez's `on_policy_created`: `INSERT INTO filez_policy_quotas (...)
VALUES (policy_id, max_bytes, max_files, max_per_file_bytes, 0, 0)`
inside the Picker's transaction.

filez's create handler (the atomic flow that used to live in the
"generic" doc):

```sql
BEGIN;

-- 1. Engine check (returns via_policy_id)
-- 2. Service-specific reserve
SELECT max_bytes, used_bytes, max_files, used_files, max_per_file_bytes
INTO   pq
FROM   filez_policy_quotas
WHERE  policy_id = $via FOR UPDATE;

-- 3. Apply caps (same logic as before, just lives in filez)
IF pq.max_bytes IS NOT NULL AND pq.used_bytes + $size > pq.max_bytes
   THEN RAISE EXCEPTION 'PolicyByteQuotaExceeded'; END IF;
-- … other caps …

-- 4. Owner's storage_quotas row (already filez-specific) — check + reserve
SELECT used_bytes, quota_bytes
INTO   sq FROM storage_quotas
WHERE  subject_id = $owner AND storage_location_id = $loc FOR UPDATE;
IF sq.used_bytes + $size > sq.quota_bytes
   THEN RAISE EXCEPTION 'StorageLocationQuotaExceeded'; END IF;

-- 5. Insert file
INSERT INTO files (id, owner_id, ..., created_via_policy_id)
VALUES ($id, $owner, ..., $via);

-- 6. Commit reservations
UPDATE filez_policy_quotas
SET    used_bytes = used_bytes + $size, used_files = used_files + 1
WHERE  policy_id = $via;
UPDATE storage_quotas SET used_bytes = used_bytes + $size WHERE id = sq.id;

COMMIT;
```

All filez. The engine watched none of it.

### The "anti-abuse" ceiling — also filez

`MAX_POLICY_QUOTA_BYTES_PER_USER` is **filez's config**, not the
engine's. filez enforces it in `on_policy_created`:

```rust
fn on_policy_created(&self, tx, policy_id, values) -> Result<()> {
    let new_max = parse_bytes(&values["max_bytes"])?;
    let owner   = engine.policy_owner(policy_id, tx);
    let live_sum = sql_in!(tx,
        "SELECT coalesce(sum(max_bytes), 0)
         FROM   filez_policy_quotas q
         JOIN   access_policies p ON p.id = q.policy_id
         WHERE  p.owner_id = $owner AND NOT p.revoked")?;
    if live_sum + new_max > config().max_policy_quota_bytes_per_user {
        return Err(FilezError::QuotaCeilingExceeded);
    }
    sql_in!(tx, "INSERT INTO filez_policy_quotas (...) VALUES (...)")?;
    Ok(())
}
```

If the engine extracts to `mows-auth-core` and a *second* service
(say a Calendar) wants its own per-policy ceiling, that service
writes its own logic in its own `on_policy_created`. Each service
controls what its quotas mean.

## How a non-filez service would plug in

Calendar example (illustrative — calendar isn't built yet):

```rust
struct CalendarQuotaExtension;
impl PolicyServiceExtension for CalendarQuotaExtension {
    fn consent_ui_schema(&self, action: ActionId) -> Option<ConsentUiSchema> {
        match action {
            CalendarAction::EventsCreate => Some(json_schema! {
                "fields": [
                    { "name": "max_events_per_day", "label": "Events per day", "type": "int",  "default": 50 },
                    { "name": "max_events_total",   "label": "Total events",   "type": "int",  "default": 500 }
                ]
            }),
            _ => None,
        }
    }
    fn on_policy_created(&self, tx, policy_id, values) -> Result<()> {
        sql_in!(tx, "INSERT INTO calendar_policy_quotas
                     (policy_id, max_events_per_day, max_events_total)
                     VALUES ($policy_id, $...)")?;
        Ok(())
    }
    fn on_policy_revoked(&self, policy_id) -> Result<()> { /* … */ Ok(()) }
}
```

Calendar registers it at startup. The Picker shows the calendar
fields when the user picks a calendar-related action. The engine
doesn't know calendars exist beyond "here's an action that has a
registered extension".

## How the two motivating cases now read

### A. Anonymous upload link with a storage budget (still works)

User Paul opens the Picker → action = `FilesCreate` on the
Submissions file_group → Picker shows filez's consent fragment
(byte / file / per-file fields). Paul fills in 5 GB / 200 / 100
MB. Picker commits one transaction:

1. `access_policies` row (engine) — same shape as before, **no
   quota columns on this table**.
2. `filez_policy_quotas` row (filez side table) — 5 GB / 200 /
   100 MB / 0 used.

Anonymous uploader uses the URL → filez handler runs the create
flow above → engine says Allow (via_policy_id is Paul's link
policy) → filez reserves quota → upload succeeds → counters
incremented.

### B. Backend writer (still works)

Paul authorises WebGrabber Daemon. Picker shows filez's consent
fragment with backend-appropriate defaults (50 GB / 10,000 /
500 MB). Same two-row commit. Same engine flow.

## What's NEW (vs the previous draft)

| Was                                                                            | Now                                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Quota columns on `access_policies`                                             | Side table `filez_policy_quotas` owned by filez                |
| Engine evaluated `quota_max_bytes`                                             | Engine knows nothing about quotas; filez handler enforces      |
| `MAX_POLICY_QUOTA_BYTES_PER_USER` in engine config                             | filez config; filez's `on_policy_created` enforces             |
| Generic create-flow SQL in the auth doc                                        | filez-specific SQL in the filez code; the doc shows it as an example of the extension contract in use |
| Picker UI hardcoded byte/file fields                                           | Picker renders whatever schema the service returns             |
| Adding a new resource-type's quota required engine changes                     | New service registers its own extension; engine untouched      |

## What `mows-auth-core` adds for this layer

Exactly:

- `AuthResult::via_policy_id() → Option<PolicyId>` (most reason
  variants already carry this; we just expose the helper).
- `trait PolicyServiceExtension` with three hooks.
- A registry: services register their extension at startup; the
  Picker consults it by `(resource_type, action)`.
- The Picker's "render this consent-UI fragment" loop.
- A documented transaction contract: the Picker opens one Tx, the
  engine inserts the policy row, then `on_policy_created` runs in
  the same Tx, then commit. If the service fails, the policy is
  rolled back too. No half-created policies.
- A `policy_bundle_id UUID NULL` column on `access_policies` (see
  next section). The engine ignores it on the hot path; it exists
  solely so a single Picker consent can group N service-specific
  policies into one user-facing grant.

That's the whole engine-side surface. No byte columns. No file
columns. No service-specific config. No cross-service unit conversion.

## Cross-API bundles — one consent that spans multiple services

Real apps need budgets across multiple APIs at once. A Gaussian-
splatting viewer needs **filez storage** (to hold uploaded models),
**AI compute** (to run inference), and possibly **realtime bandwidth**
(for collaborative editing). The user should not be asked to consent
three times in three different Pickers — they want one consent screen
that shows everything the app is asking for, then one click.

The existing PolicyServiceExtension contract already lets each
service render its own consent fragment in isolation. The bundle
mechanism stitches N such fragments into one screen, commits N
policies in one transaction, and lets the user revoke all N with one
click later.

### The minimal addition

One nullable column on the engine's policy table:

```sql
ALTER TABLE access_policies
    ADD COLUMN policy_bundle_id UUID NULL;
CREATE INDEX access_policies_policy_bundle_id_idx
    ON access_policies (policy_bundle_id)
    WHERE policy_bundle_id IS NOT NULL;
```

- `NULL` (the default) = standalone policy. This is every policy
  created today; the column is fully back-compat.
- A shared UUID across N rows = those N policies were created in one
  Picker consent transaction; the share-management UI groups them.

The engine's hot path (`check_access`, `list_visible`, all RLS
predicates) **does not read this column**. It exists for grouping,
listing in the share-management UI, and bulk-revocation queries.

### The Picker SDK request shape

Today (single-service):

```js
mowsPicker.request({
    app_id:                 '<viewer.app_id>',
    requested_actions:      ['FilesGet'],
    allowed_resource_types: ['FileGroup'],
    purpose:                'view 3D scans',
})
```

With bundles:

```js
mowsPicker.requestBundle({
    app_id:  '<gaussian-splatting-viewer.app_id>',
    purpose: 'render and refine your 3D scans',
    grants: [
        {
            service:               'filez',
            requested_actions:     ['FilesCreate', 'FilesGet'],
            allowed_resource_types:['FileGroup'],
            // filez extension contributes its consent UI here
        },
        {
            service:               'ai',
            requested_actions:     ['InferenceRun'],
            allowed_resource_types:['ModelEndpoint'],
            // ai extension contributes its consent UI here
        },
        {
            service:               'realtime',
            requested_actions:     ['ChannelSubscribe', 'ChannelPublish'],
            allowed_resource_types:['Channel'],
            // realtime extension contributes its consent UI here
        },
    ],
})
```

The Picker:

1. Looks up each grant's extension via the engine's registry
   (`(resource_type, action) → PolicyServiceExtension`).
2. Calls `consent_ui_schema(action)` on each. Renders all returned
   schemas on **one screen**, grouped by service, with the
   `purpose` text at the top.
3. On user Approve, opens **one transaction**, generates one fresh
   `policy_bundle_id`, then for each grant: inserts the
   `access_policies` row (with the shared bundle id) and calls
   `on_policy_created(tx, policy_id, consent_values)` on the
   service's extension.
4. Commits. If any single service's extension fails, the whole
   transaction rolls back — the user sees the error and can adjust
   the consent values; no half-granted bundles.

### Bulk revocation

The share-management UI lists bundles, not individual policies. A
bundle row shows: app name, purpose text, list of `(service,
human-summary)` derived from each member policy. "Revoke" runs:

```sql
UPDATE access_policies
SET    revoked = TRUE, revoked_at = now()
WHERE  policy_bundle_id = $bundle
  AND  owner_id          = $me
  AND  NOT revoked;
```

Each service's `on_policy_revoked` fires for its own rows; quotas
free up, side-tables clean up. To the engine, this is N independent
revocations.

Per-policy revoke still works for finer control — a user can revoke
just the AI grant of a bundle, keeping filez and realtime live.

### Listing bundles in the share-management UI

A single query:

```sql
SELECT policy_bundle_id,
       array_agg(id ORDER BY created_time) AS policy_ids,
       min(created_time)                   AS bundled_at,
       count(*)                            AS grant_count
FROM   access_policies
WHERE  owner_id = $me
  AND  policy_bundle_id IS NOT NULL
  AND  NOT revoked
GROUP BY policy_bundle_id;
```

Then per bundle, the UI calls each owning service's small endpoint
(`GET /me/policy/{policy_id}/summary`) to fetch the human-readable
quota line ("5 GB / 200 files" / "100 compute-minutes / 1 GPU class
A" / "10 KB/s out, 50 KB/s in"). Each call is one row lookup in the
service's side table.

### Why not put the multi-service quotas in one row on `access_policies`?

Considered and rejected:

- A JSON `quotas` blob on `access_policies` would re-introduce
  service-specific knowledge into the engine schema. Each service
  would still need a side table for atomic FOR-UPDATE
  reserve-then-commit (you can't `FOR UPDATE` a single JSON field
  without locking the whole row, killing concurrency). The blob
  would be a stale denormalisation.
- One row per `(policy, service)` would force a foreign-key from
  the engine's table into per-service tables — the very coupling
  PolicyServiceExtension was created to avoid.
- The `policy_bundle_id` grouping keeps each service's quota
  exactly where it already is (its own side table, its own
  invariants, its own concurrency model) and adds a single
  opaque-to-the-engine join key.

### How filez/AI/realtime each handle a bundle member

Nothing changes service-side. Each service's
`on_policy_created(tx, policy_id, consent_values)` runs inside the
Picker's transaction and inserts into its own side table. It does
not care whether the policy is standalone or part of a bundle — the
`policy_bundle_id` is opaque to the service.

The atomic reserve-then-commit at write time (filez's flow shown
above; analogous flows for AI compute reservations and realtime
bandwidth budgets) uses `via_policy_id` — same as today. The bundle
mechanism adds nothing to the hot path; it only affects the consent
and revocation paths.

### Cluster-wide per-user caps across services

The user's Gaussian-splatting consent might grant 50 GB filez + 200
AI compute-minutes + 1 MB/s realtime. But the cluster admin may want
to cap each user's *total* outstanding grants per service
("no user may have more than 1 TB filez quota live across all their
policies"). Three things to clarify:

- **Per-service caps stay per-service.** Filez enforces
  `MAX_FILEZ_BYTES_PER_USER` in its own `on_policy_created`, the
  AI service enforces `MAX_AI_MINUTES_PER_USER` in its own, etc.
  Each cap matches the unit the service knows. The engine never
  sees them.
- **Cluster-wide "budget remaining" display** is the manager UI's
  job, not the engine's. The manager UI calls `GET /me/budget` on
  each service in parallel; each returns `{ unit, allowed, used,
  remaining }` for that service. The UI shows three bars: storage,
  compute, bandwidth. No new engine concept needed.
- **Cross-service trade-offs (e.g., "you have 100 capacity units to
  spend across services")** are explicitly out of scope. They
  require defining a common unit, which destroys each service's
  ability to model its own resource. If a cluster operator wants
  this, they implement it in a dashboard layer on top.

### Bootstrapping a bundle request from an app's manifest

A new MOWS app declares its bundle shape in its install manifest
(machine-readable, used by the manager UI to render the "what this
app will ask for" preview before install):

```yaml
# manifest.yaml (excerpt)
authorization:
    bundle_grants:
        - service: filez
          requested_actions: [FilesCreate, FilesGet]
          allowed_resource_types: [FileGroup]
          default_quota:
              max_bytes: 5GB
              max_files: 200
        - service: ai
          requested_actions: [InferenceRun]
          allowed_resource_types: [ModelEndpoint]
          default_quota:
              max_compute_minutes: 100
              allowed_gpu_classes: [A, B]
        - service: realtime
          requested_actions: [ChannelSubscribe, ChannelPublish]
          allowed_resource_types: [Channel]
          default_quota:
              max_in_bytes_per_sec: 1MB
              max_out_bytes_per_sec: 1MB
```

When the user installs the app from the catalog, the manager UI
calls `mowsPicker.requestBundle(...)` with the manifest's grants
verbatim. Defaults pre-fill the consent fields; the user adjusts and
approves. The install completes; the bundle is live; the app has
exactly the cross-API access it declared.

### Decision summary for bundles

| Question                                                             | Decision                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Where does the cross-service grouping live?                          | One nullable `policy_bundle_id UUID` column on `access_policies` |
| Does the engine read it on the hot path?                             | **No.** Only used by share-management UI and bulk-revocation    |
| How are per-service quotas tracked inside a bundle?                  | Each service's own side table, exactly as today                 |
| Are bundles atomic to create?                                        | **Yes.** One transaction, all N rows or none                    |
| Are bundles atomic to revoke?                                        | **Yes.** One UPDATE; each service's `on_policy_revoked` fires per row |
| Can a bundle be partially revoked?                                   | **Yes.** Per-policy revoke still works                          |
| Cross-service unit (one common "credit")?                            | **No.** Each service keeps its native unit                      |
| App manifests can declare bundle shapes?                             | **Yes** — used by the manager UI to render install previews     |

## Security properties preserved

The split doesn't weaken anything from the previous design — every
service-side check is still atomic via `FOR UPDATE`, every quota
exhaustion still surfaces as a typed error, every revocation still
cascades. What changes is **where the logic lives**: in the service
that owns the resource type, not in the auth engine.

The "anti-abuse" idea remains essential — it's just enforced by
each service's `on_policy_created`. If filez doesn't enforce a
ceiling, a malicious frontend could spam Paul with consent
prompts that each grant unbounded byte quotas. The ceiling is
filez's job because filez is the system that knows what a byte
is.

## What this does NOT change

- The auth-engine primitives (`check_access`, `list_visible`,
  Picker, RLS) are unchanged.
- The `access_policies` schema gets *no new columns* for usage.
- The existing filez `storage_quotas` table is unchanged.
- The consent flow from CONSENT_FLOW.md is unchanged shape-wise;
  only the rendered fields differ per service.
- Backend on-behalf-of from BACKEND_APPS.md is unchanged; backends
  get the same `PolicyByteQuotaExceeded` error from filez when
  filez's quota is exhausted.

## Bottom line

The engine stays a pure authorization layer that doesn't care
what's being authorized. Each MOWS service owns its own usage
model. The contract between them is one helper on `AuthResult`,
one trait with three methods, and one documented transaction
shape for atomic two-row creates. Byte/file quotas for filez,
event-per-day quotas for a future calendar, record-per-zone
quotas for Pektin — all plug in the same way, none of them leak
into `mows-auth-core`.
