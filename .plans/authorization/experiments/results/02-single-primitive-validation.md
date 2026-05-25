# Iteration 2 — single auth primitive, validated at medium scale

User feedback drove a critical redesign: every REST handler must call
**exactly one** auth primitive, never compose its own auth SQL. The
attack surface of N hand-rolled queries per service is unacceptable.

Two functions exposed by the engine:

- `check_access(user, app, resource_type, resource_id, action)` — point
  decision
- `list_visible(user, app, resource_type, action, scope, cursor_ts,
  cursor_id, page_size)` — paginated listing

Plus Postgres Row-Level Security as defence in depth. RLS calls the
same `check_access(...)` function, so the rules cannot drift between
the primitive and the safety net.

## The implementation gotcha — SQL function inlining

Postgres only inlines `LANGUAGE sql` functions whose body is a single
SELECT (no CTEs, no UNION). My k-way merge with 7 CTEs cannot inline.
A LANGUAGE plpgsql function uses parameter binding, which gives the
planner a *generic plan* that doesn't push the per-source `LIMIT` into
each subquery scan. At medium scale this was a 250× slowdown.

Solution: **PLPGSQL with `EXECUTE format(...)`** — build a fresh SQL
string with literal values per call, run it with EXECUTE. The
planner sees real values, picks a custom plan, pushes predicates.
Planning cost ~0.5ms; total cost stays within ~5× of the inline SQL
upper bound.

Concretely:

| Implementation                                | scope=All p99 at medium |
| --------------------------------------------- | ----------------------: |
| PLPGSQL with bound parameters (initial)       | 88 ms                   |
| LANGUAGE sql with CTEs (attempted inline)     | 188 ms                  |
| PLPGSQL with EXECUTE format(literals)         | **6.4 ms**              |

This is now part of LISTING.md / DATA_MODEL.md guidance: any
multi-CTE engine query MUST use EXECUTE format() inside the primitive.

## Headline numbers at medium scale (1M files, 678k policies)

| Primitive call                            | p99           |
| ----------------------------------------- | -------------:|
| `list_visible(scope=Owned)`               | **0.16 ms**   |
| `list_visible(scope=All)` authenticated   | **6.4 ms**    |
| `list_visible(scope=All)` anonymous       | **1.0 ms**    |
| `check_access` — owner                    | 0.09 ms       |
| `check_access` — public allow             | 0.58 ms       |
| `check_access` — default deny             | 0.80 ms       |

For comparison (these are the **rejected** approaches we are NOT
using, kept as evidence):

| Approach                                              | medium      |
| ----------------------------------------------------- | -----------:|
| Naive `UNION + EXCEPT` allowed-set materialisation    | 2,148 ms    |
| Public listing via raw JOIN to access_policies        | 571 ms      |
| **Cover-backed primitive (current)**                  | **1.0 ms**  |

## Defence-in-depth — RLS bypass test

Force a non-admin role to hit `files` directly without going through
the primitive. RLS applies; the predicate calls `check_access` per
row.

| Path                                  | Time     | Buffer hits | Correct? |
| ------------------------------------- | --------:| -----------:| -------- |
| Direct `SELECT … FROM files` (RLS)    | 25.46 s  | 21,463,899  | ✓        |
| Through `list_visible(...)` primitive | 1.22 ms  | 193         | ✓        |

The direct query is 20,000× slower but **still secure** (300,000
rows correctly filtered). RLS catches bugs that bypass the API. The
massive perf penalty is the incentive to use the right path.

## Security suite

All 18 cases pass against the new primitive:

- SuperAdmin shortcut
- Owner / trusted-app shortcuts
- Deny > Allow precedence (direct and via resource-group)
- Public vs ServerMember separation (anonymous cannot match ServerMember)
- App-context filtering (specific app vs nil-uuid "any app")
- Revoked policies ignored
- Expired policies ignored
- Group-mediated allows + selective deny
- Resource not found
- All 9 lifecycle combinations

`scripts/security.sh` is the canonical CI gate. It exercises the
exact same `check_access()` function that production handlers call
and that RLS uses for defence in depth. Coverage drift between the
API path and the RLS path is structurally impossible — one
implementation.

## What changed in the design docs

- **ARCHITECTURE.md §3.7a (new)**: documents the single-primitive
  rule. No handler writes its own auth SQL. RLS as backstop.
- **LISTING.md §4**: rewritten — OwnerOnly is an internal branch
  inside the primitive, not a SQL fragment returned to handlers.

## What needs no change

- DATA_MODEL.md: cover tables, indexes, schema layout — all validated.
- POLICY_SEMANTICS.md: the evaluation order is what the primitive
  implements; no semantic changes.

## Next iteration

Iteration 3 targets:

1. Target scale (10k users / 10M files / 1M Public / 5M ServerMember /
   1M policies). Confirm primitives stay flat.
2. Pathological scenarios: a user in a 1000-member group with a broad
   share on a 100k-file file_group.
3. AccessibleByOwner recursion (LISTING.md §7).
4. Pagination walk across 5 pages of cover via cursor.
5. Trigger-based cover maintenance under write churn (correctness).
