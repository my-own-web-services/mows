# MOWS Authorization — Live Experiments

This folder runs the authorization design against a real Postgres so we
can prove (or disprove) the strategies in `../LISTING.md`,
`../POLICY_SEMANTICS.md`, and `../DATA_MODEL.md`.

Authorization correctness is security-critical. Paper designs are not
enough; every claim about scale and every claim about precedence
(`Deny > Allow > default-deny`) is exercised here against real data.

## Quick start

```bash
# 1. bring up the database
bash scripts/up.sh

# 2. apply schema + indexes + cover machinery
bash scripts/apply-schema.sh

# 3. seed at chosen scale (tiny / small / medium / target)
bash scripts/seed.sh tiny

# 4. run security correctness tests (must all pass)
bash scripts/security.sh

# 5. run benchmark suite at the seeded scale
bash scripts/bench.sh

# 6. tear down
bash scripts/down.sh
```

Results land in `results/<scale>-<timestamp>.md`.

## What we test

### Performance strategies (LISTING.md)

Each scenario from LISTING.md §9 has a benchmark in `benchmarks/`. We
compare three approaches per relevant scenario:

| Code  | Strategy                                                | When                                       |
| ----- | ------------------------------------------------------- | ------------------------------------------ |
| `OO`  | OwnerOnly fast-path (no policy lookups)                 | LISTING.md §4                              |
| `NU`  | Naive UNION + EXCEPT (the rejected approach)            | proof it breaks at scale                   |
| `SM`  | Sorted-stream merge with keyset pagination              | LISTING.md §5 — the recommended strategy   |
| `CT`  | Cover-table lookup                                      | LISTING.md §6 — for Public/ServerMember    |

### Security correctness (POLICY_SEMANTICS.md)

`security/` contains assertion-style SQL: each script computes the
expected `Allow`/`Deny` for a constructed scenario and `RAISE
EXCEPTION` if Postgres disagrees. Categories:

1. Ownership shortcut never grants access to non-owners.
2. Deny precedence: a single Deny defeats any number of Allows.
3. Public vs ServerMember: anonymous requests cannot match a
   ServerMember policy.
4. App-context filter: a policy whose `context_app_ids` doesn't
   contain the requesting app must not apply.
5. AccessibleByOwner cycle break: depth-1 recursion does not
   self-amplify.
6. Revoked / expired policies do not affect outcomes.
7. SuperAdmin always allowed.
8. Resource-not-found returns Deny (no existence leak).

## Scales

| Name     | Users | Files  | Policies | UserGroups | RG (file_groups) | Public shares | ServerMember shares |
| -------- | ----- | ------ | -------- | ---------- | ---------------- | ------------- | ------------------- |
| `tiny`   | 50    | 1k     | 200      | 10         | 20               | 50            | 100                 |
| `small`  | 500   | 100k   | 10k      | 50         | 200              | 1k            | 5k                  |
| `medium` | 2k    | 1M     | 100k     | 200        | 2k               | 100k          | 500k                |
| `target` | 10k   | 10M    | 1M       | 1k         | 100k             | 1M            | 5M                  |

`tiny` exists to validate query shapes and indexes in <30s of total
run time. `target` matches LISTING.md §1.

## Iteration log

Each iteration produces a markdown report under `results/`. We do not
edit prior reports; new iterations append a new file. Surprises feed
back into the design docs in the parent folder.

- **`results/00-iteration-plan.md`** — the plan we follow.
- **`results/01-small-medium-findings.md`** — owner-only is flat;
  cover beats raw-JOIN 500–1750×; naive UNION+EXCEPT degrades
  catastrophically; security suite passes.
- **`results/02-single-primitive-validation.md`** — user feedback
  reshaped the API to a single primitive (`check_access` +
  `list_visible`). Discovered the EXECUTE-format() planning trick
  for multi-CTE merges. RLS as defence in depth proven (20,000×
  perf penalty for bypass).
- **`results/03-target-scale.md`** — 10k users / 10M files / 6.78M
  policies. All primitives sub-25ms p99. RLS bypass takes 5 minutes
  vs 1.4ms through the API. 29 security cases pass.
- **`concepts/results.md`** — separation + quotas + atomicity.
  Validates the five concepts from DEPLOYMENT.md / USAGE_LIMITS.md /
  BACKEND_APPS.md / CONSENT_FLOW.md in a single self-contained
  experiment. All 6 tests pass — including 500 parallel uploads
  producing the exact quota counter (50,000,000 bytes / 500 files,
  zero drift).

## Bottom line

The single-primitive design is the right shape. Two functions:
`check_access` and `list_visible`. Postgres RLS underneath as
defence in depth. Cover tables for hot subjects (Public,
ServerMember, large user-groups). EXECUTE format() inside the
primitive to defeat Postgres's generic-plan trap.

Performance gates from `experiments/results/03-target-scale.md` are
the SLO budgets ARCHITECTURE.md §6 commits to.
