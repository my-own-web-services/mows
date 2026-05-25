# Concepts experiment — separation, quotas, atomic uploads

Self-contained experiment that validates the new concepts:

1. **Cross-schema separation** (DEPLOYMENT.md) — `mows_auth.*`
   vs `filez.*` schemas. Filez queries cross-schema-JOIN to
   `mows_auth.access_policies` in one connection.
2. **DB role enforcement** (DEPLOYMENT.md §"DB roles") — the
   `filez_role` cannot INSERT into `mows_auth.access_policies`
   even if it tries. Postgres rejects at the role level.
3. **Per-service quotas** (USAGE_LIMITS.md) — filez owns its
   `filez_policy_quotas` side table; the atomic
   `filez_create_file_with_quota(...)` function checks both the
   per-policy cap and the storage_location cap and increments
   counters in one transaction.
4. **Atomic concurrent uploads** — under simulated concurrent
   uploaders via the same Public link, the counters end up exact
   (no over-count, no double-count).
5. **Cross-schema speed** — verify a query that JOINs across
   schemas runs at the same speed as a single-schema query.

Each test asserts an outcome and `RAISE EXCEPTION`s on mismatch.
The whole suite must pass for the design to be considered viable.

## Run

```bash
bash run.sh
```

Wipes the database, builds the cross-schema setup, runs the
fixture seed, runs the test suite, and prints a clean pass/fail
report.
