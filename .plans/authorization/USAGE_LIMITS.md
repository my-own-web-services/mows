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

That's the whole engine-side surface. No byte columns. No file
columns. No service-specific config.

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
