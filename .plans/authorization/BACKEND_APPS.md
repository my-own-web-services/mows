# BACKEND_APPS — User-authorized access for non-browser apps

The consent flow in `CONSENT_FLOW.md` covers third-party SPAs: the
user is in a browser, the Picker pops up, the user picks a resource
and approves. But many MOWS apps run *as backend services* with no
attached browser session — backup daemons, indexers, sync workers,
ML jobs, webhook receivers. They still need user authorization to
touch user-owned data.

This doc explains how a backend app obtains and uses that
authorization. The engine primitives (`check_access`, `list_visible`),
the policy storage, and the Picker UI are all unchanged. The only
new mechanic is **how the backend declares which user it's acting
for, and how the engine verifies that declaration**.

## Three modes a backend can run in

| Mode             | When                                                           | Who is `requesting_user` in the engine?      |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------- |
| **On-behalf-of** | Backend acts for a specific user it has standing authorization from. The dominant case. | The user named in the `X-Mows-On-Behalf-Of` header — *but only if a policy authorises the backend to claim that identity*. |
| **Self-action**  | Backend acts as itself — system-wide bookkeeping, public-content indexing, admin-blessed tasks. | `NULL` (no user). The auth check runs against `Public`/`ServerMember` policies. |
| **Job-pickup** *(existing)* | Backend processes discrete jobs queued by users. | The job's `owner_id`, set automatically by the auth middleware when the backend picks the job up. |

The first two are the new design. Job-pickup already works in filez
and is documented in `apis/cloud/filez/server/src/http_api/authentication/middleware.rs`.

## On-behalf-of mode — the dominant pattern

### How the user authorises a backend

The user opens the manager UI (or any first-party app's "App access"
panel). The list of registered backend apps is shown — apps where
`MowsApp.app_type = Backend`. The user selects one (e.g. "Backup
Daemon"), then uses the standard Picker to pick the resources to
authorise.

This is the **exact same Picker** from `CONSENT_FLOW.md`. The only
difference is the requesting app is a registered backend, not a
SPA running in the user's browser. The Picker's request shape:

```js
mowsPicker.request({
    app_id:                 '<backup-daemon.app_id>',
    requested_actions:      ['FilesGet'],
    allowed_resource_types: ['FileGroup'],
    multi:                  true,
    purpose:                'to back up the contents of this folder nightly',
    delivery:               'standing'   // not 'allow-once' — backends usually need standing access
})
```

The resulting policy row is identical in shape to the SPA case —
self-owned, `Single` scope, narrow action set, durable. The
backend now has authorization for those specific resources via that
specific user.

### How the backend uses the authorisation

When the backend wants to act, it sends one of two header
combinations:

| Auth path                             | Headers                                                                                  | Purpose                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| **Zitadel Client Credentials** (preferred — AUTHENTICATION.md §3.3) | `Authorization: Bearer <client-credentials-token>` + `X-Mows-On-Behalf-Of: <user-uuid>`  | client_id in the introspected token identifies the backend; on-behalf-of declares the user |
| **Kubernetes SA token** (legacy, in-cluster only) | `X-Mows-Service-Account-Token: <sa-token>` + `X-Mows-On-Behalf-Of: <user-uuid>`          | TokenReview identifies the SA → backend; on-behalf-of declares the user |

Both paths resolve to the same `MowsApp` row and run the same
EXISTS-check below. The auth middleware:

1. Identifies the backend.
   - **Zitadel path:** Introspects the bearer token; joins
     `mows_auth.apps` on `external_client_id` to resolve the
     `MowsApp`. Rejects if `app_type` is not `Backend` or `Api`.
   - **SA path:** Verifies the SA token via `TokenReview` (existing
     filez logic); maps `system:serviceaccount:<ns>:<sa>` to a
     `MowsApp` row, `app_type = Backend`. Rejects if the SA does
     not map to a registered backend.
2. Reads the on-behalf-of header.
3. **Validates the impersonation** by checking the policy table.
   `effect = 1` (Allow) is essential — without it, a user who tries to
   revoke a backend's impersonation by adding a *Deny* policy (rather
   than revoking the original Allow) would inadvertently keep the
   impersonation gate open, because the Deny row also matches the
   predicate. Only active Allow rows grant impersonation:
   ```
   EXISTS (
       SELECT 1 FROM access_policies
       WHERE  subject_type = 0                       -- User
         AND  subject_id   = <on-behalf-of>
         AND  context_app_ids @> ARRAY[<app.id>]
         AND  effect = 1                             -- Allow only
         AND  NOT revoked
         AND  (expires_at IS NULL OR expires_at > now())
   )
   ```
   If yes, sets `requesting_user = <on-behalf-of user>`.
   If no, rejects the request with 403 `BackendNotAuthorisedByUser`.
4. Hands off to the normal handler, which calls
   `check_access(requesting_user, requesting_app, …)` like any
   other request. The policy row that authorised the impersonation
   is *the same row* that allows the resource access — no
   separate "you may impersonate" vs "you may read" check.

**The existence of a policy IS the authorization.** No bearer
tokens, no refresh dance, no "consent grant" stored elsewhere. The
policy table already encodes everything the engine needs.

### Why this is safe

- A backend can only claim to act for a user who has at least one
  active policy authorising it. No policy → no impersonation.
- Even with valid impersonation, the backend gets only what the
  policy allows. Listing returns only those resources; per-resource
  checks still run.
- Revocation is one UPDATE. Next request from the backend with the
  same on-behalf-of header returns 403.
- The on-behalf-of header is *not a secret*. It's a UUID claim that
  the engine validates against the policy table. Leakage of the
  header value gives no advantage to an attacker — they'd also need
  the backend's SA token (which is rotated by Kubernetes).
- Audit: every action is logged with both `app_id` (the backend)
  and `user_id` (the impersonated user) — full attribution.

### Bootstrapping — first user authorising a fresh backend

A backend that has just been installed has no users yet. It needs
to invite one. Pattern:

1. Operator deploys the backend; it registers as a `MowsApp`
   (Backend type) via its install manifest.
2. Operator (or the backend itself, on first run) generates a
   **consent invite URL**:
   ```
   https://<cluster-tld>/picker?app=<backup-daemon.app_id>
                                &purpose=…
                                &allowed_resource_types=FileGroup
                                &requested_actions=FilesGet
                                &delivery=standing
                                &state=<opaque-poll-token>
   ```
3. User opens the URL in any browser they're logged into the MOWS
   cluster with. The Picker shows the standard consent UI.
4. On approve, the Picker creates the policy and POSTs a small
   notification to the backend's `/mows-consent-callback`
   endpoint with the `state` token (so the backend knows *which*
   invitation was just consented to) and the user/resource ids.
5. Backend stores `(user_id, resource_ids)` in its own state and
   starts acting on-behalf-of that user from then on.

This is the OAuth "authorisation request" URL pattern, adapted for
the standing-grant + opaque-callback shape MOWS uses instead of
tokens.

For backends without a callback endpoint (CLI tools, ML jobs),
substitute the callback with a *poll endpoint* the backend hits:

```
GET /api/v1/consent-requests/{state} → 200 with policy_id once granted, 404 until then
```

### Multi-user backends

A backend that serves many users (e.g. a per-tenant indexer) keeps
a list `[(user_id, resource_ids, policy_ids), …]` in its own
database. On each action it picks the right user and sends the
matching on-behalf-of header. Periodically it scans for newly
authorised users by querying its own policy list (the engine
exposes `list_my_authorisations(app_id)` for this — returns every
policy whose `context_app_ids` contains the requesting backend's
id, scoped by some sort key for keyset pagination).

The backend never sees other users' resources. The engine's
existence check rejects on-behalf-of claims for users who haven't
authorised it.

## Self-action mode

When the backend isn't acting for any specific user — it's just
"the system doing system things". Examples:

- A public-content indexer that reads every `Public`-shared file
  and builds a search index. No user is the requester; the
  indexer just needs access to the Public surface.
- A daily metrics collector that reads aggregate file counts.
- An admin-blessed broad reader (e.g., the manager UI's audit
  backend).

The backend sends only the SA-token header (no on-behalf-of). The
auth middleware sets `requesting_user = NULL`. The engine then
matches policies with `subject_type IN (ServerMember, Public)`
that have the backend in `context_app_ids`.

For admin-blessed broad access, an administrator creates a
type-level policy:

```
subject_type    = Public                         -- or ServerMember
context_app_ids = [<the backend's app_id>]
resource_type   = <whatever>
resource_id     = NULL                           -- type-level
resource_scope  = OwnedByOwner / 0 (depending)
actions         = [FilesGet, FileGroupsListFiles]
effect          = Allow
```

A "give this backend read access to every Public file" policy is
exactly one row. The engine evaluates it like any other.

## Comparison to OAuth Service Accounts / Client Credentials

| OAuth Service Account flow                     | MOWS Backend mode                                     |
| ---------------------------------------------- | ----------------------------------------------------- |
| App has a client_id + client_secret            | App has a Kubernetes SA token (rotated by K8s)        |
| App exchanges credentials for a bearer token   | App sends the SA token + on-behalf-of header each request |
| Token has embedded scopes                      | Scopes live in `access_policies` rows                 |
| User-impersonation needs a separate "JWT bearer" or "domain-wide delegation" flow | One mechanism: the existence of a policy authorises the impersonation |
| Token TTL forces refresh                       | Policy `expires_at` is enforced engine-side; no refresh dance |
| Revocation is by token denylist                | Revocation is one UPDATE on the policy row            |

The MOWS shape eliminates the bearer-token plumbing entirely. The
backend's identity is its SA (managed by Kubernetes). The user's
authorization is a policy row (managed by the user via the
Picker). The engine's job is just to verify both.

## Engine-side changes required

Compared to the design in CONSENT_FLOW.md / APP_AUTHORIZATION.md,
the backend support adds exactly:

1. **Auth middleware enhancement** — when both an SA-token and an
   on-behalf-of header are present, validate the
   `EXISTS (access_policies …)` predicate above, then set
   `requesting_user` accordingly.
2. **`list_my_authorisations(app_id, cursor, page_size)` primitive**
   — for backends to discover which users authorised them and for
   what resources. It's a thin wrapper around `list_visible(...)`
   but with subject = the calling backend app (treating the policy
   table itself as the resource).
3. **`/mows-consent-callback` standard** — a documented endpoint
   shape backends opt into, for the bootstrap flow. Optional;
   poll-based works too.
4. **Picker UI gains a "share with backend app" mode** — same
   request shape, list of registered backends to choose from.

No changes to `check_access`, `list_visible`, the policy table
schema, the cover tables, or the RLS predicates. The on-behalf-of
header is the only new input.

## Security properties

| Property                                  | How it's enforced                                     |
| ----------------------------------------- | ----------------------------------------------------- |
| Backend can only impersonate authorised users | EXISTS-check in middleware, rejects otherwise         |
| Backend can only access authorised resources  | Same `check_access` as everyone else                  |
| User can revoke instantly                 | UPDATE one row; next request fails                    |
| Backend's SA token rotation               | Kubernetes handles it; tokens are short-lived          |
| Replay / token leakage                    | On-behalf-of is not a secret; SA token is rotated; effective TTL is short |
| Audit                                     | Every action logged with both `app_id` and impersonated `user_id` |
| Backend compromise                        | Limited to resources of users who authorised it; each user's grants are narrow (`Single` scope) by default |
| Scope creep                               | A compromised backend cannot widen its access — the policies were created via the Picker by the user explicitly |
| Detection                                 | The "App access" panel shows every user → backend authorisation; admin can audit; per-resource access logs |

## Failure modes and what they look like

- **Backend uses on-behalf-of for a user who never authorised it.**
  → middleware rejects with 403 `BackendNotAuthorisedByUser`.
  Backend should treat this as "user revoked me" and stop trying.
- **Backend tries to access a resource the user authorised it for,
  but the user later revoked.**
  → `check_access` returns `DefaultDeny`. The middleware accepted
  the impersonation (other policies may still exist), but the
  specific action is denied. Backend should remove the resource
  from its working set.
- **Backend's SA token expires/rotates mid-request.**
  → next request fails with auth error; Kubernetes-managed,
  backend code re-reads the token from disk on each request (or
  refreshes via the projected service-account-token volume).
- **Picker generated invite URL is leaked.**
  → an attacker can open it but the Picker requires the user to be
  logged into the cluster; if the attacker is also logged in, they
  can authorise the backend to act for *their own* account, which
  doesn't help them attack the original user. The invite is not a
  secret token.

## What this does NOT solve

- **Backends that need access to many users without each having
  acted.** That's an admin-policy decision, not user consent. It
  uses the self-action mode with an admin-issued broad policy.
- **Federated backends in another cluster.** Out of scope (same
  reason multi-cluster is out of scope generally).
- **End-to-end encryption.** A backend that has consent to read a
  resource gets the resource's plaintext. If a user wants to keep
  data confidential from the backend, they shouldn't grant
  access. No auth system can prevent post-grant exfiltration.

## Net effect

The backend story collapses to:

1. The Picker can authorise a backend, same as it authorises a SPA.
2. The backend uses SA-token + on-behalf-of header to identify
   itself + claim a user it's acting for.
3. The engine verifies the impersonation via the policy table —
   same table that authorises the action itself.
4. Revocation, audit, expiry, listing — all the same primitives as
   the rest of the system.

One new header, one EXISTS check in middleware, one Picker-UI mode.
Zero changes to the schema, the primitives, or the security model.
