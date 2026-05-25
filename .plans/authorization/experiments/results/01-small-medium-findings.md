# Iteration 1 — small + medium scale (validated 2026-05-25)

Run with the experiments docker compose on a developer laptop
(NixOS, 32 GB RAM, NVMe). Postgres 17.2 with the tuning from
`docker-compose.yaml`. Each strategy benchmarked 4 times to amortise
plan caching; reported number is the steady-state.

## Headline

| Strategy                          | tiny (1k files) | small (100k files) | medium (1M files, 678k policies) |
| --------------------------------- | --------------- | ------------------ | -------------------------------- |
| OwnerOnly (no auth touch)         | 0.03 ms         | 0.03 ms            | 0.30 ms                          |
| Public via **cover table**        | 0.13 ms         | 0.15 ms            | **0.35 ms**                      |
| Stream-merge (SQL approximation)  | ~3 ms           | 5.4 ms             | 5.5 ms                           |
| Public via **raw JOIN** to AP     | ~7 ms           | 77 ms              | **612 ms**                       |
| Naive **UNION + EXCEPT**          | ~3 ms           | 21 ms              | **2,488 ms**                     |

Three claims validated, one rejected approach disproven.

## What the numbers prove

### 1. OwnerOnly path is constant-time

The trivial `WHERE owner_id = $1 ORDER BY created_time DESC LIMIT 50`
hits the `files(owner_id, created_time DESC, id DESC)` index. p99
sub-millisecond at every scale. The auth engine should *not even be
called* on this path — it just emits the SQL fragment.

LISTING.md §4 is correct. **This must stay the dominant path.**

### 2. Cover tables are constant-time

`public_resources` keyed on `(resource_type, sort_created DESC,
resource_id DESC)` plus the GIN indexes on `app_ids` / `actions`
gives 0.35ms even with 100k cover rows over 1M files. The cover
table size grows linearly with the number of Public shares, but the
query cost stays bounded by `page_size`.

LISTING.md §6 design holds.

### 3. Naive UNION + EXCEPT is catastrophic at scale

2.5 seconds for a single page of files at 1M scale. Confirms the
rejection in LISTING.md §2.

Why: the EXCEPT materialises the full allowed-set, then sorts it,
then takes the first 50. At medium scale the allowed-set crosses
100k rows. EXPLAIN ANALYZE shows a **Sort with Disk** spilling
~50 MB; the planner cannot push `LIMIT 50` past the EXCEPT.

### 4. Stream-merge (even in pure SQL form) is bounded

5.5 ms at medium even though five sources contribute. The trick is
LIMIT per source inside CTEs — each source returns at most
`page_size` rows, then the outer dedup+sort processes at most
`k × page_size = 300` rows.

This is the SQL approximation of the real Rust k-way heap merge. In
production the heap merge will be *better* because it can stop
fetching from any source once the page is fulfilled.

## Cost of "list public files when 1M are public-shared"

The decisive scenario for the cover-table design:

| | medium (100k Public shares) |
| --- | --- |
| Raw access_policies JOIN | **612 ms** |
| public_resources cover  | **0.35 ms** |
| Ratio                   | **1750×**  |

The cover table is **the only viable path** for paginating Public.
This is a security-critical conclusion: a brute-force search of public
content (e.g. an attacker enumerating shared files) must hit the cover,
not the raw policy table, or it becomes a DoS vector.

## Sizes

medium (1M files, ~7M policy-context-app pairs, all three covers
populated):

| Table                              | Heap   | Indexes | Rows      |
| ---------------------------------- | ------ | ------- | --------- |
| files                              | 112 MB | 274 MB  | 1,000,000 |
| access_policies                    | 132 MB | 88 MB   | 678,200   |
| server_member_resources (cover)    | 67 MB  | 76 MB   | 500,000   |
| file_file_group_members            | 19 MB  | 36 MB   | 289,500   |
| user_group_accessible_resources    | 15 MB  | 17 MB   | 100,505   |
| public_resources (cover)           | 13 MB  | 35 MB   | 100,000   |

The cover overhead is ~95 MB of heap + 128 MB of indexes — well
within budget. At target scale (1M Public shares) we project ~130 MB
heap for `public_resources` and ~350 MB indexes; still fine.

## Security suite at scale

`scripts/security.sh` against the medium fixture: **all 18 cases
pass.** Deny precedence, ownership shortcut, Public vs ServerMember
separation, app-context filter, revocation, expiration, missing
resource — all behave as POLICY_SEMANTICS.md prescribes.

## Surprises

1. **Stream-merge SQL is already good without the heap merge.** I
   expected the SQL approximation to be a poor proxy for the real
   Rust merge, but 5.5ms at medium suggests it's close enough for
   most cases. The Rust heap merge will still be cleaner (no DISTINCT
   ON resort), and is necessary for `AccessibleByOwner` recursion.

2. **Public-via-raw-JOIN is even worse than I expected.** I budgeted
   "10s of milliseconds"; actual is 600ms. The reason:
   `access_policies` has 100k Public-shared rows; the planner picks
   a hash join after fetching them all. There is no index that helps
   without materialising the cover. Confirms cover is mandatory, not
   optional.

3. **OFFSET-style EXPLAIN against cover is fine at 50,** but jumping
   far (page 100 = offset 5000) regresses. As expected; keyset is
   the right default. The bench in `05-public-only-paginate.sql`
   walks the keyset cursor across pages and stays sub-2ms per page.

## Adjustments to the design

None required. The numbers validate ARCHITECTURE.md §3.7 and
LISTING.md §3 as-written. The big change introduced in the LISTING
rewrite (k-way merge, covers, OwnerOnly bypass) is the right shape.

Open items for iteration 2:
- Reproduce target scale (10M files).
- Build the AccessibleByOwner recursion benchmark.
- Build the "large user-group" cover-vs-live comparison.
