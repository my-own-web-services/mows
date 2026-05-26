# MOWS Authorization — Design Set

This folder is the working design space for the MOWS authorization system. It
extracts what works in the existing `filez` access-policy engine, generalises
it to a system-wide primitive, and addresses the open questions raised in
`IDEA.md`.

## Reading order

1. **[IDEA.md](./IDEA.md)** — the original seed (Paul's first sketch).
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — what we are building, the goals,
   the boundaries, and the major design choices with the rationale behind each.
3. **[DATA_MODEL.md](./DATA_MODEL.md)** — concrete tables, types, and the
   key invariants that hold across them. Includes the proposed shared crate
   layout (`mows-auth-core`) so every MOWS service can depend on the same
   primitives.
4. **[POLICY_SEMANTICS.md](./POLICY_SEMANTICS.md)** — the precise evaluation
   algorithm for `is user A allowed to perform action X on resource R using
   app C?`. Includes the precedence rules (Deny > Allow > default-deny),
   ownership shortcut, trusted-app shortcut, and the type-level vs.
   instance-level distinction. Mirrors today's filez implementation but
   formalised and de-duplicated.
5. **[LISTING.md](./LISTING.md)** — the *what can I see* problem,
   designed for **10k users × 10M resources × 1M policies**. Covers
   the owner-only fast path (no auth-engine code path), the k-way
   sorted stream merge with keyset pagination, materialised covers
   for Public/ServerMember/large-groups, and lazy recursive
   expansion for `AccessibleByOwner`. Worst-case SLOs per scenario.
6. **[USER_GROUPS.md](./USER_GROUPS.md)** — invitation, public, and
   restricted-listed groups. Membership lifecycle, join requests, and
   delegated administration.
6a. **[AUTHENTICATION.md](./AUTHENTICATION.md)** — the AuthN side, kept
    strictly separate from authorization. Zitadel as the only token
    issuer; one Zitadel principal per API and per app (in addition to
    humans); how each request shape produces the
    `(requesting_user, requesting_app)` pair the engine consumes;
    the realtime API as a worked second-API example.
7. **[APP_AUTHORIZATION.md](./APP_AUTHORIZATION.md)** — apps as first-class
   subjects, account-less app access, trusted apps, scope grants by the user,
   and the "share an object with an app even when I'm offline" pattern.
7a. **[CONSENT_FLOW.md](./CONSENT_FLOW.md)** — the OAuth-style + Resource
    Picker flow third-party SPAs use to obtain user consent for a specific
    resource. JS SDK, security properties, what's first-party vs third-party.
7b. **[BACKEND_APPS.md](./BACKEND_APPS.md)** — how non-browser apps
    (backup daemons, indexers, sync workers, webhook receivers) get
    user-scoped access via on-behalf-of headers. SA-token + on-behalf-of
    pattern, bootstrap invite URLs, self-action mode, job-pickup mode.
7c. **[USAGE_LIMITS.md](./USAGE_LIMITS.md)** — service-specific
    per-policy quotas. The engine stays unit-free; each service
    (filez for bytes, future calendar for events, future DNS for
    records) plugs in via a small extension contract. Picker
    renders the service's consent-UI fragment. Atomic two-row
    create (engine policy + service quota row). Examples: anonymous
    upload link with a 5 GB filez budget; backend that may write up
    to 50 GB to my account.
7d. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — how the auth system is
    separate (own repo, own Picker pod, own DB role, own RLS layer)
    yet keeps listing at 3 ms p99 at 10M-row scale. Shared Postgres
    instance with `mows_auth` and per-service schemas; cross-schema
    JOIN in one connection; no network hop for `check_access` or
    `list_visible`. Why a sidecar microservice is rejected on the
    latency budget.
8. **[OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md)** — decisions still to be made.
   Each entry lists the trade-offs and a tentative recommendation, but
   nothing in this file is final.
8a. **[REVIEW-vs-mows-vision.md](./REVIEW-vs-mows-vision.md)** — multi-
    perspective gap analysis cross-checking this design against the
    MOWS project vision on mows.cloud. Status table per finding plus
    the full report; read this before adding new scope.
9. **[ROADMAP.md](./ROADMAP.md)** — the implementation order. Phase 0
   (extract from filez), Phase 1 (shared crate + migrations), Phase 2
   (listing index), Phase 3 (group lifecycle), Phase 4 (per-app scopes).

## Conventions used here

- `Subject` — the entity *being granted* access (a user, a user group, the
  set of all logged-in users, the public).
- `Resource` — the entity *to which* access is granted (a file, a group,
  an app definition, …). Every resource has a `(resource_type, resource_id)`
  identity.
- `App` — the *context* under which the request is made. A policy is only
  consulted if its `context_app_ids` contains the requesting app. This is
  the same idea as today's `MowsApp`.
- `Action` — a verb, scoped to a resource type. We will keep these enumerated
  (no free-text scopes) to make policy queries plain integer comparisons.
- `Effect` — `Allow` or `Deny`. `Deny` always wins.

## What this design intentionally is *not*

- It is not an attempt to reproduce AWS IAM or Zanzibar wholesale. Both were
  considered and rejected as too heavy for a single-cluster home/private
  cloud. See ARCHITECTURE.md §"Alternatives considered" for the explicit
  reasoning.
- It is not a replacement for Zitadel. Zitadel remains the OIDC provider
  (identity, login, MFA). MOWS Authorization sits *after* authentication
  and answers "what may this already-authenticated principal do?"
- It is not a runtime policy language (no Rego, no Cedar). Policies are
  rows in Postgres. The expressivity we need fits in tabular form, and that
  keeps listing tractable (see LISTING.md).
