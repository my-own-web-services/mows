# Phase 3/4/5 Post-Batch Multi-Review

6-perspective review (Security, Tech, QA, Architecture, Slop,
Future Proofing) of the batch landed since the prior phase4-review:
P4-9 row-based auth, P4-10 default-policy bootstrap, P5-1 audit_log,
P5-2 cover-table reconciler, P5-3 materialize_uga, P3-1 SortedStream
foundation, P3-2 OwnedStream.

Markers: `❌` = open, `✅` = resolved, `⁉️` = not a real issue or
deliberately out of scope.

---

## Summary

| Perspective    | Critical | Major | Minor |
| -------------- | -------- | ----- | ----- |
| Security       | 0        | 0     | 3 + 3 informational |
| Technology     | 0        | 3     | 6     |
| QA             | 2        | 5     | 3     |
| Architecture   | 4        | 5     | 6     |
| Slop           | 0        | 3     | 10    |
| Future Proof   | 2        | 6     | 4     |

After deduplication (many overlapping findings):
**~5 critical actionable**, **~10 major actionable**, rest deferred or false.

---

## Actionable now

- **A1** ❌ `PolicyStore::stream_owned_resources` defaults to `Ok(vec![])`.
  A future store impl that forgets to override returns silently empty —
  no compile-time signal. (TECH-3 / ARCH-1 / SLOP-3 same root.)
  **Fix:** default returns `AuthError::Evaluation("stream_owned_resources
  not implemented for this store …")` so the engine fails loud when a
  store ships without the impl.

- **A2** ❌ `merge_streams` doesn't validate that streams yield items
  in DESC order. A misordered stream silently produces wrong results.
  (TECH-2 / QA-3.)
  **Fix:** wrap each stream in a `#[cfg(debug_assertions)]` validator
  that asserts the order invariant; in release builds the contract is
  trusted.

- **A3** ❌ Background tasks (`background_tasks/mod.rs`) loop forever
  on errors with no backoff — a broken DB gets thrashed every interval.
  (SLOP-2.)
  **Fix:** add exponential backoff on consecutive failures (1× → 4×
  → 24×) capped at the configured interval.

- **A4** ❌ `recompute_user_group_materialize_flags` uses a correlated
  `COUNT(*)` subquery — O(groups × members) at scale. (FUTURE-F8.)
  **Fix:** replace with a single `LEFT JOIN … GROUP BY` so postgres
  scans `user_user_group_members` once.

- **A5** ❌ Seed migration 00016 uses `ON CONFLICT (id) DO NOTHING` —
  if the existing row is wrong (effect=Deny, missing actions), the
  conflict is silent. (SLOP-4.)
  **Fix:** switch to `DO UPDATE SET …` so the seed row is self-healing
  on every re-run.

- **A6** ❌ Stream error mid-page is untested — `merge_streams` may
  not cleanly propagate. (QA-2.)
  **Fix:** add a test with an `ErrorStream` that returns
  `Err(AuthError::Evaluation)` after yielding one item; assert the
  merge returns Err.

- **A7** ❌ Empty-stream case is untested — every stream returns
  `Ok(None)` on first call. (QA-1.)
  **Fix:** test with two `EmptyStream` instances; assert
  `page.resource_ids.is_empty()` and `page.next_cursor.is_none()`.

- **A8** ❌ `OwnedStream` store-error propagation untested. (QA-5.)
  **Fix:** test with an `ErrorStore` that errors from
  `stream_owned_resources`; assert `OwnedStream::next()` returns Err.

- **A9** ❌ Default-policy bootstrap rollback untested. (QA-7.)
  **Fix:** source-grep guard pinning that `create_one` does run a
  transaction with the policy inserts + group insert. Integration test
  deferred (no test DB rig).

- **A10** ❌ Materialize-flag recompute job duplicates audit_log row
  + `info!` log; pick one. (SLOP-9.)
  **Fix:** keep the audit_log row (durable, queryable); demote
  `info!` to `debug!` (live-ops only).

- **A11** ❌ `merge_streams` `page_size = 0` untested — handler bugs
  would loop. (QA-4.)
  **Fix:** test that `page_size = 0` returns empty page.

## Deferred / out of scope this round

- **D1** ⁉️ Background tasks lack graceful shutdown (TECH-1). The
  server has no shutdown signal channel today; adding one is a
  bigger refactor than this review's scope. Tracked for a follow-up.

- **D2** ⁉️ Deny-check missing from `merge_streams` (SLOP-6). By
  design — Phase 3 P3-3 lands it. Documented in the merge function's
  docstring + LISTING.md §5.3.

- **D3** ⁉️ `audit_log` table location (FUTURE-F1/F3, ARCH-3): "move
  to mows-auth-core / mows_auth schema for Phase 6". Phase 6 work;
  tracked in ROADMAP. Today single consumer = filez-local is fine.

- **D4** ⁉️ `AuditEvent` enum location (ARCH-3, FUTURE-F2): same as
  above. Phase 6.

- **D5** ⁉️ `OwnedStream` not abstract over backend (ARCH-2). Same as
  above. The trait IS abstract (`<S: PolicyStore + ?Sized>`); the
  reviewer wanted further abstraction over batch-fetch strategy. Phase
  6 can refactor when a second consumer demands it.

- **D6** ⁉️ `SortKey` polymorphism for non-timestamp sorts (FUTURE-F4).
  Phase 3 ships `created_time DESC` only; other dimensions land with
  the rest of the streams (P3-4+). Trait shape can absorb the change.

- **D7** ⁉️ `StreamSource` enum not extensible (FUTURE-F5). Adding a
  variant is a `cargo check` away — it's not exposed as a wire format,
  it's a runtime tag.

- **D8** ⁉️ `BackgroundTask` trait abstraction (ARCH-5). Three tasks is
  not yet enough to justify the abstraction overhead.

- **D9** ⁉️ Adaptive scoring for materialize threshold (FUTURE-F11,
  ARCH-13). ROADMAP P5-3a (fixed) ✅; P5-3b (adaptive) is a separate
  future PR. Fixed threshold is the documented Phase 5 deliverable.

- **D10** ⁉️ Multi-tenancy `tenant_id` column (FUTURE-F12). Not on
  the roadmap; premature.

- **D11** ⁉️ Materialize threshold trigger on join/leave (ARCH-11,
  SLOP-1). Daily lag is the documented Phase 5 trade-off — adding
  per-write triggers couples the hot path to the materialise decision
  for marginal benefit.

- **D12** ⁉️ ROADMAP scope-claim language (ARCH-9). Updated in commit
  `85b0dcd3`; reviewer's diff predates that.

- **D13** ⁉️ Integration tests against a real postgres (QA-8/9/10).
  The repo has no test DB rig; manual `docker run postgres:17` proofs
  cover the most critical paths. Tracked separately.

- **D14** ⁉️ ROADMAP Phase 6 cross-consumer redesigns (ARCH-1/2/3/4,
  FUTURE-F1/F2/F3). Out of scope; Phase 6 surfaces concrete
  requirements.

- **D15** ⁉️ All "remove tracing::info, keep only audit_log"-style
  reorganisations beyond A10. Tracing remains useful for live-ops
  debugging in parallel with the durable audit record.

- **D16** ⁉️ All "make 1024 char limit a const" / extract magic
  numbers asks. validate/utoipa attribute macros need literal ints —
  can't share a `const`. (Closed in prior review as ⁉️.)
