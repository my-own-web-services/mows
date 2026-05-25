# Experiment iteration plan

Iteration 1 — small + medium scale, validate the **strategy
ordering**. We now know:

- OwnerOnly is flat regardless of scale (as expected — index hit only)
- Public cover beats Public-via-raw-JOIN by 500× at small,
  growing to ~1750× at medium
- Naive UNION+EXCEPT degrades catastrophically — 2.5s at 1M files,
  matching the predicted failure
- Stream-merge in SQL form stays sub-10ms

Iteration 2 — target scale (10k users / 10M files / 1M Public).
Goals:
- confirm OwnerOnly + cover + stream-merge stay flat
- confirm naive UNION+EXCEPT becomes unusable (>10s)
- measure pagination latency for cursor walks across the cover

Iteration 3 — pathological scenarios. Specifically:
- a user in a large user-group with a broad Allow on a 100k-file group
  (must stay sub-100ms via cover)
- a user with 200 AccessibleByOwner policies (recursive expansion;
  worst case in LISTING.md §7)
- Deny precedence under high write churn (correctness, not perf)

Iteration 4 — feed surprises back into the design docs and
re-run security suite.
