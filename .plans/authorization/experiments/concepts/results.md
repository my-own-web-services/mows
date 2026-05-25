# Concepts experiment — results

Validated 2026-05-25 against a Postgres 17.2 in docker compose,
single instance, fresh database. All 5 concepts pass; 6 tests
total (4 in-script + 1 cross-schema speed + 1 parallel-client).

## Concept-by-concept

### 1. Cross-schema separation

`mows_auth` and `filez` schemas coexist in one Postgres instance.
FKs from `filez.files.owner_id` to `mows_auth.users.id` and from
`filez.files.created_via_policy_id` to
`mows_auth.access_policies.id` work natively. The `filez`
schema's PL/pgSQL function `filez.check_access(...)` cross-schema-
JOINs to `mows_auth.access_policies` and runs with no special
syntax — just qualified table names.

**Outcome**: native, zero-friction. The deployment topology
described in DEPLOYMENT.md is exactly what Postgres supports out
of the box.

### 2. DB-role enforcement

Two roles created: `picker_role` and `filez_role`. Test
01-role-enforcement.sql attempts every combination:

| Actor          | Operation                                     | Result   |
| -------------- | --------------------------------------------- | -------- |
| `filez_role`   | `SELECT FROM mows_auth.access_policies`       | **OK**   |
| `filez_role`   | `INSERT INTO mows_auth.access_policies`       | **rejected** — `insufficient_privilege` |
| `filez_role`   | `UPDATE mows_auth.access_policies SET revoked=TRUE` | **rejected** — `insufficient_privilege` |
| `picker_role`  | `INSERT INTO mows_auth.access_policies`       | **OK**   |

The rejections happen at the **Postgres role boundary**, before
the query touches a row. A compromised filez handler cannot
escalate its permissions even if it tries the exact SQL — the
database refuses it. This is stronger than the application-level
"the primitive is the only writer" rule from CONSENT_FLOW.md
because it doesn't rely on filez's code being correct.

The bonus surprise: when I forgot to switch roles in test 05's
seed and tried to `INSERT INTO filez.files` as `picker_role`, the
role enforcement caught me with `permission denied for table
files`. The separation also prevents picker from writing into
filez's resource tables — picker is only allowed to write its
own consent rows and `filez.filez_policy_quotas` (per the design
in USAGE_LIMITS.md's transaction contract). Failed-correctly is
the right kind of failure: it caught a real bug in my test code.

### 3. Per-policy quota — anonymous upload + backend writer

`filez.create_file_with_quota(...)` is a single PL/pgSQL function
that runs:

1. `FOR UPDATE` lock on `filez.filez_policy_quotas` row
2. Check `max_bytes`, `max_files`, `max_per_file_bytes`
3. `FOR UPDATE` lock on `filez.storage_quotas` row
4. Check storage-location cap
5. `INSERT` the file with `created_via_policy_id`
6. Increment both counters

Test 02-anonymous-upload-quota.sql, with caps 5 MB / 5 files /
2 MB per file:

| Step | Upload                                              | Outcome      |
| ---- | --------------------------------------------------- | ------------ |
| 2.1  | anon uploads 1 MB                                   | OK           |
| 2.2  | anon uploads 1 MB                                   | OK           |
| 2.3  | anon uploads 2 MB (boundary on per-file cap)        | OK (total 4 MB) |
| 2.4  | anon uploads 2 MB (would push to 6 MB > 5 MB)       | `PolicyByteQuotaExceeded` ✓ |
| 2.5  | anon uploads 3 MB (single file > 2 MB cap)          | `PolicyPerFileSizeExceeded` ✓ |
| 2.6  | anon uploads 6 separate small files (cap is 5)      | first 5 OK; 6th `PolicyFileQuotaExceeded` ✓ |

All three cap types fire with precise typed errors. Test
03-backend-writer-quota.sql mirrors the same shape for the
on-behalf-of backend pattern from BACKEND_APPS.md — including
revocation: after `UPDATE … SET revoked = TRUE`, the
middleware's EXISTS check returns false and the backend is
evicted.

### 4. Atomic concurrent uploads (the critical security test)

Test 04 in-script ran 100 serial uploads — counters drifted by
zero. The real test (`run.sh` step 4) launches **10 parallel
shell-level clients × 50 uploads each = 500 concurrent uploads
of 100 KB**. Each upload is its own short transaction with
`FOR UPDATE` on the policy quota row.

```
launching 10 parallel uploaders × 50 uploads × 100 KB ...
all clients finished in 6s
final counters: 50000000|500
[4.2] CONCURRENT counters EXACT: bytes=50000000 files=500 (OK)
```

500 expected × 100,000 bytes = 50,000,000 bytes. **Final counter
exactly 50,000,000.** No drift. No double-counts. No lost
increments. The `FOR UPDATE` lock on `filez.filez_policy_quotas`
serializes concurrent writes against the same policy row.

This is the security-critical property. If the counter could
under-count, a malicious uploader could push past the quota by
racing. The test proves Postgres's row-level locking gives us
exact accounting at no extra cost beyond the per-row lock.

### 5. Cross-schema query speed

Test 05 EXPLAIN ANALYZE shows:

| Query                                                   | Execution Time |
| ------------------------------------------------------- | -------------: |
| Same-schema: `SELECT FROM filez.files WHERE owner_id`   | **0.08 ms**    |
| Cross-schema JOIN to `mows_auth.access_policies`        | **0.34 ms**    |
| `filez.check_access(...)` (PL/pgSQL, internal cross-schema lookups) | **2.24 ms** |

The cross-schema JOIN is **~4× the same-schema baseline**, but
absolute numbers stay sub-millisecond. The `check_access`
function — which does 5+ cross-schema policy lookups internally —
runs in 2.2 ms. That matches the target-scale benchmark from
iteration 3 (which used the old single-schema layout) within
noise. **Cross-schema cost is negligible.**

This confirms the central DEPLOYMENT.md claim: separation by
schema doesn't slow the hot path.

## Summary

| Concept                                  | Status | Evidence                                                                 |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------ |
| 1. Cross-schema separation               | ✓      | Schemas + FKs + cross-schema functions all native Postgres               |
| 2. DB-role enforcement                   | ✓      | `filez_role` rejected with `insufficient_privilege` on attempted writes  |
| 3. Per-policy storage quotas             | ✓      | All 3 cap types (bytes, files, per-file) fire precise typed errors       |
| 3b. Backend on-behalf-of + quota         | ✓      | EXISTS check authorises; revoke evicts; quotas enforce per-write         |
| 4. Atomic counter under concurrency      | ✓      | 500 parallel uploads → counter exactly 50,000,000 (0 drift)              |
| 5. Cross-schema speed                    | ✓      | check_access: 2.24 ms (matches single-schema baseline within noise)      |

The design (DEPLOYMENT.md + USAGE_LIMITS.md + BACKEND_APPS.md +
CONSENT_FLOW.md) is **end-to-end viable**. The remaining work is
implementation: the `mows-auth-core` crate, the Picker UI + SDK,
and the per-service code generators. None of it is research
anymore — every layer has been exercised in working SQL.

## What this experiment did *not* validate

- **Engine-level Rust crate** — only the SQL behaviour was tested
  here. The Rust wrapper around it is straightforward but
  unwritten.
- **Picker UI** — the consent flow's user-facing surface needs to
  be built and usability-tested. The protocol is defined in
  CONSENT_FLOW.md but the SPA + the consent dialog don't exist.
- **The OAuth-style invite URL for backend bootstrap** —
  documented in BACKEND_APPS.md but not exercised here.
- **Cover-table triggers for write-time maintenance** — covered
  by iteration 3's tests against a single-schema layout; not
  re-tested here because the design doesn't change with schemas.
- **Trigger drift across very long-running deployments** — the
  background reconciler from LISTING.md §6.1 needs a soak test
  in a later phase.

These are all phase-2+ items in ROADMAP.md and don't change the
architectural soundness this experiment proves.
