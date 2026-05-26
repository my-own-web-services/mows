# AUTHENTICATION — Who is making this request?

Authorization (the rest of this folder) answers *may this principal do
X?*. Authentication answers *who is this principal in the first
place?*. The two are kept strictly separate — the authorization engine
never calls back into the identity provider on the hot path, and the
identity provider never knows anything about MOWS resources or
policies.

This doc pins down the authentication side that the rest of the
design has been treating as a black box: which identity provider, what
principals exist in it, what the principals look like in MOWS, and how
each request shape produces the `(requesting_user, requesting_app)`
pair the engine consumes.

## 1. The split: AuthN vs AuthZ

| Job                                  | Owned by              | Lives in                          |
| ------------------------------------ | --------------------- | --------------------------------- |
| Login, MFA, password reset, IdP fed. | Zitadel               | Zitadel's database                |
| Issuing access tokens                | Zitadel               | OIDC discovery + token endpoints  |
| Validating a presented token         | each service's middleware | Zitadel introspection (cached) |
| Mapping the token to a MOWS user     | each service's middleware | `mows_auth.users` row, keyed by Zitadel `sub` |
| Mapping the calling app to MOWS      | each service's middleware | `mows_auth.apps` row, keyed by Zitadel `client_id` |
| *Then* — may they do the thing?      | `mows-auth-core`      | `mows_auth.access_policies`       |

Authentication is a precondition for authorization. By the time the
engine's `check_access` runs, the middleware has already produced
`(Option<MowsUser>, MowsApp)`. Anonymous requests still have a
`MowsApp` (the sentinel "no-origin" app for fully-public URLs); they
just have `None` for the user.

## 2. Zitadel topology — one IdP, structured per cluster

**Pluggable, even though v1 has exactly one provider.** The
sovereignty principle precludes hard-coding Zitadel into the schema
or the engine. The compromise:

- DATA_MODEL.md §2.1 / §2.2 carry an **`idp_id` discriminator** on
  `users` and `apps`. v1 has exactly one row in `idp_providers`
  named `'zitadel'`. A future Keycloak / Authentik adoption inserts
  a second row; the UNIQUE constraint is `(idp_id, external_user_id)`
  / `(idp_id, external_client_id)` so two IdPs that happen to issue
  the same opaque `sub` do not collide.
- The middleware's token introspection is a trait
  (`TokenIntrospector`). v1 has one implementation
  (`ZitadelIntrospector`); a second IdP adds a second impl. The
  hot path — look up `mows_auth.apps` / `mows_auth.users` by
  `(idp_id, external_*_id)` then call `check_access` — is
  IdP-agnostic.
- Zitadel-specific concepts (organization, project, OIDC client
  type) live in the install scripts and the Zitadel introspector,
  not in `mows_auth.*` schema or the engine.

Schema cost of forward-compat: one column. Adding a second IdP
later: zero schema migrations. The rest of this section describes
the **v1 Zitadel implementation** — what one Zitadel instance per
MOWS cluster looks like.

One Zitadel instance per MOWS cluster. The cluster sets up one
Zitadel **organization** representing itself. Inside that
organization:

| Zitadel concept        | What it represents in MOWS                                   |
| ---------------------- | ------------------------------------------------------------ |
| **Organization**       | The MOWS cluster (one per cluster)                           |
| **User**               | A human account: cluster admin, end user                     |
| **Project**            | One per API: `filez-project`, `realtime-project`, future `calendar-project`. Defines the API's scopes and roles. |
| **OIDC application** (Public, Code+PKCE) | One per frontend app (filez UI, music-player SPA, manager UI). Public client, no client secret. |
| **OIDC application** (Confidential, Client Credentials) | One per backend app and one per API. Each holds a client secret. |
| **Service user**       | The identity that backs each non-human OIDC application. Has a `sub` like any human; is what tokens are issued *for*. |

Zitadel is the only thing that issues tokens. Every other piece of
the system *consumes* tokens, never issues or signs its own.

## 3. The principle: every API and every app is a Zitadel principal

The decision this doc records:

> **There is exactly one Zitadel principal per API and per app in the
> cluster, in addition to the Zitadel users that represent humans.**

That means a fresh cluster's Zitadel organization, after install,
contains:

- one Zitadel user per human (created on first login, or pre-seeded
  for cluster admins),
- one OIDC application per **frontend app** (Code+PKCE, public),
- one OIDC application + backing service user per **backend app**
  (Client Credentials, confidential),
- one OIDC application + backing service user per **API** (Client
  Credentials, confidential — used for API-to-API calls).

Why this shape:

- **Every actor that ever signs a request has a distinct, addressable
  identity** in one place. No two apps share a client_id; no API
  signs requests as "anonymous". Audit trails attribute every action
  to one principal.
- **Revocation, rotation, MFA, IdP federation** all become Zitadel
  concerns — uniform across humans and machines.
- **The MOWS `apps` table becomes a thin projection of Zitadel
  clients**, keyed by the Zitadel `client_id`. The two never disagree
  about which apps exist because Zitadel is the source of truth.
- **APIs talking to each other** (e.g., filez emitting an event to
  the realtime API) use the same machinery as any other client — a
  Client Credentials grant — instead of a parallel cluster-internal
  trust mechanism (mTLS, shared secrets, network-level allowlists).

### 3.1 Human users

Created in Zitadel (interactively, via IdP federation, or via
admin-side provisioning). On first authenticated request to any MOWS
API, the service's middleware:

1. Validates the bearer token via the active `TokenIntrospector`
   (v1: `ZitadelIntrospector`).
2. Looks up `mows_auth.users` by `(idp_id, external_user_id) =
   (current_idp.id, sub)`.
3. If absent, inserts a row (just-in-time provisioning), copying
   email and display name from the introspection response.
4. Returns the `MowsUser` to the handler.

The `mows_auth.users` row holds only what the engine and audit log
need: `id`, `idp_id`, `external_user_id`, `display_name`, `email`,
`user_type` (normal vs super-admin). Profile pictures, MFA settings,
sessions — all stay in Zitadel.

### 3.2 Frontend apps (SPAs)

Every browser-resident SPA is a Zitadel Public OIDC client using
Authorization Code with PKCE. There is one such client per app:

- `mows-manager-ui` (first-party, trusted)
- `filez-ui` (first-party, trusted)
- `realtime-debug-ui` (first-party, trusted)
- `music-player-spa` (third-party, *not* trusted)
- `photo-viewer-spa` (third-party, *not* trusted)

The redirect URIs are fixed at app-registration time. The access
token the SPA receives contains both the user's `sub` and the SPA's
`client_id` (Zitadel populates the `azp` / `client_id` claim).
Services map the `client_id` to a `mows_auth.apps` row to populate
`requesting_app`.

The browser `Origin` header continues to be checked as defense in
depth — it must match one of the redirect origins registered for
that client — but it is no longer the *primary* app identifier. The
client_id is.

### 3.3 Backend apps (daemons, indexers, sync workers)

Each backend is a Zitadel Confidential OIDC client using Client
Credentials, plus its backing service user. The backend gets:

- `client_id` and `client_secret` at registration time (stored as a
  Kubernetes Secret in the namespace; rotated via Zitadel's UI / API).
- a way to obtain an access token: POST to Zitadel's token endpoint
  with the client credentials, get back a JWT.

On every request to a MOWS API the backend includes that JWT as
`Authorization: Bearer …`. The API introspects it; the `client_id`
identifies the backend's `mows_auth.apps` row; the absence of a user
sub means `requesting_user = None` (self-action mode — see
`BACKEND_APPS.md` §Self-action), unless the request also carries an
`X-Mows-On-Behalf-Of` header (on-behalf-of mode).

The Kubernetes service-account-token path described in
`BACKEND_APPS.md` §"How the backend uses the authorisation" remains
*supported* for in-cluster backends that want to avoid an extra
secret to manage; both paths produce the same `MowsApp` and feed the
same `EXISTS(access_policies …)` check. See §8 below for the
migration story.

### 3.4 APIs (filez, realtime, future-calendar)

Each API itself has a Zitadel client + service user. It uses Client
Credentials to obtain a token for the *narrow* set of cases where one
API calls another (e.g., filez POSTs a file-change event to the
realtime API; the manager UI's backend asks filez for usage
statistics). For the dominant case — the API receiving a request
from a browser or backend — the API is the *audience*, not the
*caller*; it doesn't need its own token for that.

Having each API hold its own Zitadel identity:
- Lets an API authenticate to another API the same way a backend
  app does (one mechanism, not two).
- Makes "API calls API" auditable in the same logs as everything
  else — the calling API's `client_id` shows up in the receiving
  API's request log.
- Avoids a special "trust the cluster's network" rule, which would
  break the moment we add a sidecar mesh, a multi-zone deploy, or a
  federated cluster.

## 4. Mapping Zitadel principals to engine tables

### 4.1 `mows_auth.users`

| Column                  | Source                                              |
| ----------------------- | --------------------------------------------------- |
| `id`                    | UUID generated by MOWS at first-login provisioning  |
| `idp_id`                | FK into `idp_providers` (v1: the `zitadel` row)     |
| `external_user_id`      | IdP-issued `sub` claim                              |
| `display_name`          | IdP-issued `name` / `preferred_username`            |
| `email`                 | IdP-issued `email` (if `email_verified`)            |
| `user_type`             | MOWS-only (`Normal`, `SuperAdmin`); not in IdP      |
| `created_time`, ...     | MOWS-only                                           |

Zitadel does not know about `user_type`. The cluster admin promotes
a user to `SuperAdmin` via the manager UI; that change writes only to
`mows_auth.users`. This is deliberate — see OPEN_QUESTIONS.md Q7.

### 4.2 `mows_auth.apps`

| Column                  | Source                                                 |
| ----------------------- | ------------------------------------------------------ |
| `id`                    | UUID generated by MOWS at registration                 |
| `idp_id`                | FK into `idp_providers` (v1: the `zitadel` row)        |
| `external_client_id`    | IdP-issued OIDC client_id                              |
| `name`                  | Human-readable; from the registration manifest         |
| `app_type`              | `Frontend` (Code+PKCE) or `Backend` (Client Credentials) or `Api` (new — see §3.4) |
| `origins`               | For Frontend apps: redirect origins. Kept as defense in depth; cross-checked against `Origin` header. |
| `trusted`               | Admin-granted; controls the owner-only short-circuit (see APP_AUTHORIZATION.md §2). |
| `created_time`, ...     | MOWS-only                                              |

The `(idp_id, external_client_id)` composite is the new join key
replacing the origin-based lookup as the primary path. The origin
lookup is retained as a secondary check for Frontend apps (it's a
free defense-in-depth signal; an attacker who steals a refresh token
still has to come from a registered origin).

For the sentinel "no-origin" anonymous app (`id = nil_uuid`), there
is no Zitadel principal — anonymous requests carry no token. This is
the only `MowsApp` row without a Zitadel mapping, and it's
deliberately the only one.

## 5. Request shapes — six concrete patterns

For each, the inputs the request carries and the
`(requesting_user, requesting_app)` the middleware produces.

| # | Pattern                              | Token / headers presented                                       | `requesting_user`                      | `requesting_app`                          |
| - | ------------------------------------ | --------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| 1 | Anonymous browser → API              | none (or a token rejected by introspection)                     | `None`                                 | sentinel `no-origin` app (`id=nil_uuid`)  |
| 2 | Logged-in browser SPA → API          | `Authorization: Bearer <user-token>`; `Origin: <spa-origin>`    | `Some(user)` from `sub`                | `mows_auth.apps` row from `client_id`     |
| 3 | Backend app, self-action → API       | `Authorization: Bearer <backend-token>`                         | `None`                                 | `mows_auth.apps` row from `client_id`     |
| 4 | Backend app, on-behalf-of user → API | `Authorization: Bearer <backend-token>`; `X-Mows-On-Behalf-Of: <user-uuid>` | `Some(user)` *iff* `EXISTS` check passes (see BACKEND_APPS.md) | `mows_auth.apps` row from `client_id`     |
| 5 | API → API (e.g., filez → realtime)   | `Authorization: Bearer <calling-api-token>`                     | `None` (or on-behalf-of header for fan-out from a user-triggered action) | `mows_auth.apps` row for the calling API |
| 6 | Anonymous browser, public link → API | `Authorization` absent; URL contains a resource ID granted via `subject_type = Public` | `None`                                 | sentinel `no-origin` app                  |

Patterns 2 and 4 are the only ways `requesting_user` becomes
non-`None`. Patterns 3, 5, 6 are deliberately userless and rely on
`Public` / `ServerMember` policies (3 and 5) or `Public` policies
with optional `context_app_ids` constraints (6) to authorize the
action.

The legacy Kubernetes-SA-token path (filez today) is **equivalent in
shape to pattern 3 or 4** — the middleware just identifies the app
via the SA token instead of the JWT's `client_id`. The
`(requesting_user, requesting_app)` output is identical, which is why
the migration in §8 is non-breaking for the engine.

## 6. The realtime API — a concrete second-service example

The realtime API is the worked example of "a second API alongside
filez". Concretely: a service that pushes events over WebSocket
(file-change notifications, presence, chat messages, future
notification streams). The auth questions it raises are the same
ones any future API will raise; documenting them here so the answers
are not re-derived per service.

### 6.1 WebSocket handshake authentication

A WebSocket connection is one long-lived HTTP/1.1 Upgrade request.
The bearer token rides on the handshake's `Authorization` header
exactly like any other request. The realtime API introspects it
once at handshake time, populates `(requesting_user,
requesting_app)`, and attaches both to the connection's state. From
that point on, every server-pushed message is filtered through the
authorization engine against that pair — exactly the same
`check_access` and `list_visible` primitives filez uses.

### 6.2 Token refresh on long-lived connections

Access tokens expire (typically 1 hour). A WebSocket connection
that stays open longer needs a way to refresh. Two patterns:

- **Server-side re-introspection per N minutes.** The realtime
  service re-checks the token's `exp` and re-introspects before it
  expires; if the token is dead and no refresh path exists, it
  closes the connection. Simple, no client cooperation needed.
- **Client-pushed refresh.** The SPA refreshes its access token
  (silent OIDC flow), then sends a `{type: 'refresh_token', token:
  ...}` message over the open WebSocket. The server re-introspects.
  Preserves the connection across hours.

Recommendation for v1: server-side re-introspection. Close the
connection on expiry; the client reconnects, which re-runs the
handshake and re-establishes auth. Simpler invariants. Client-pushed
refresh is a v2 ergonomic improvement.

### 6.3 The same Zitadel token reaches both APIs

When the user logs into the filez UI, the SPA obtains an access
token from Zitadel scoped to the user. By default Zitadel issues
tokens whose audience is the project they're issued for, but with
the "project trust" setting (or by configuring the SPA's client to
have access to multiple projects), one token can be valid against
both filez and realtime.

We standardize on: one Zitadel project per cluster contains the
cluster's APIs, and SPAs request the union of API scopes they need.
A user's access token then works against any API in that project
without requiring per-API logins. The user logs in once; the SPA
juggles which API to call. The middleware in each API independently
introspects the token, independently resolves the user and app, and
independently evaluates authorization.

This is what makes "one MOWS cluster ≈ one Zitadel session" work for
users in practice — no token swapping, no per-service consent
screens (those are MOWS-side via the Picker, not Zitadel-side).

### 6.4 Cross-API calls under user context

When filez wants to tell the realtime API "user U just uploaded file
F" (so realtime can push the event to anyone subscribed to F's
group), filez **uses its own service-account token plus an
`X-Mows-On-Behalf-Of` header** (pattern 4 / 5 hybrid). The calling
API is filez; the `X-Mows-On-Behalf-Of` is the user. Realtime's
middleware runs the same `EXISTS(access_policies …)` check as it
would for any backend impersonator — except the impersonator here
is another API. The user must have authorized filez to impersonate
them to realtime, which by the cluster's standard install is
implicit (cluster-internal APIs are pre-trusted to fan out user
actions to each other via a seed policy created at install time and
auditable like any other policy row).

**Forwarding the user's bearer token to a downstream API is not
permitted.** It would violate the app-isolation invariant the
project stakes its name on (Story.tsx "Apps run completely isolated
by default"): once a token leaves the API the user handed it to,
that downstream service can call any other API in the cluster as
the user — bypassing the policy-table consent the whole engine
exists to enforce. The on-behalf-of pattern keeps each API's right
to impersonate the user explicit, revocable, and auditable.

## 7. Lifecycle: provisioning, rotation, revocation

| Event                                          | Where it happens                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| New cluster install                            | mows-cli provisions the Zitadel organization, the per-API projects, the first-party app clients, and seeds `mows_auth.apps` with their `client_id`s. |
| New human user                                 | Zitadel handles signup / IdP login; first authenticated request to any API JIT-provisions the `mows_auth.users` row. |
| New app installed (first- or third-party)      | **Admin-only in v1** (APP_AUTHORIZATION.md §9a). Admin selects the app + version in the manager UI; mpm registers a Zitadel OIDC client via the install-time admin grant and inserts the `mows_auth.apps` row with `(idp_id = zitadel, external_client_id = <new>)`. The manifest's bundle grants are shown to the admin for review; on approve the bundle policies are inserted in one transaction. First-party apps get `trusted = true`; third-party apps stay `trusted = false`. |
| App update                                     | mpm detects a manifest change; re-runs the bundle-grant preview; admin approves any new grants or quota increases. The `policy_bundle_id` is preserved across updates so revoke-by-bundle keeps working. |
| App uninstall                                  | One UPDATE: `revoked = TRUE WHERE created_by_app = <app>`; each service's `on_policy_revoked` fires per row; Zitadel client deleted; `mows_auth.apps.revoked = TRUE` (row kept for audit). |
| Backend app client-secret rotation             | Zitadel-side rotation; the backend's Kubernetes Secret is updated by an operator. No MOWS-side change required. |
| Revocation of an app                           | Zitadel revokes the client; in parallel, `mows_auth.apps` is marked `revoked = TRUE`. Tokens cached in introspection caches survive their TTL (typically minutes); per-policy revocation in `access_policies` is the fast path for revoking *what an app can do*, separately. |
| User account disabled                          | Zitadel disables the user; introspection returns `active = false`; the middleware rejects with 401. `mows_auth.users` row remains for audit (we don't delete user rows because policies and resources reference them). |

## 8. Migration from current Origin / SA-token approach

Filez today identifies apps by `Origin` header (frontends) and
Kubernetes service-account token (backends). The Zitadel-based
identification described above is additive — both can coexist while
we migrate.

Order of operations:

1. **Add `external_client_id` column to `mows_auth.apps`** (nullable
   initially) and populate it for the first-party apps as they get
   registered in Zitadel.
2. **Middleware learns to read `client_id` from the introspected
   token** and prefers it over Origin when present. Origin lookup
   stays as a fallback for any app not yet migrated and as a defense-
   in-depth check for migrated apps.
3. **Backends get a path to use Zitadel client credentials instead of
   SA tokens.** Both paths produce the same `MowsApp`. New backends
   are encouraged to use Zitadel; existing backends can stay on SA
   tokens until they want to rotate.
4. **The sentinel `no-origin` app stays exactly as it is** — anonymous
   requests have no token, so the Zitadel path doesn't apply.
5. **Once all apps have an `external_client_id`**, the Origin lookup
   becomes purely a defense-in-depth check (rejected unless it
   matches the registered origins for the resolved client). The
   primary join is on `client_id`.

No engine code changes. No `access_policies` shape changes. The
middleware change is one Diesel query swap (lookup by `client_id`
instead of by `Origin`), gated on the column being populated.

## 9. Failure modes

| Failure                                                      | Resulting behavior                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| Zitadel introspection endpoint unreachable                   | Middleware fails closed → 503. Introspection cache (already in filez) reduces blast radius for already-seen tokens within TTL. |
| Token rejected (expired, revoked, wrong audience)            | 401 `Unauthenticated`. Engine never sees the request.       |
| Token valid, but `sub` not in `mows_auth.users` and JIT provisioning fails (DB down) | 503; the user retries after the DB is back.                 |
| Token valid, but `client_id` not in `mows_auth.apps`         | 403 `UnknownApp`. (Third-party apps must be pre-registered.) Defends against an attacker who creates a Zitadel client but never goes through MOWS-side registration. |
| Backend presents token without on-behalf-of for a request that requires user context | Engine runs in self-action mode; if no `Public`/`ServerMember` policy matches, 403 `Forbidden`. |
| Backend presents on-behalf-of for a user who never authorized it | EXISTS check fails → 403 `BackendNotAuthorisedByUser` (per BACKEND_APPS.md). |
| Zitadel down at cluster startup                              | Services start in "degraded" mode and reject all
authenticated requests until Zitadel is back; anonymous Public-link reads still work because they need no introspection. |
| Two Zitadel clients accidentally registered with the same `external_client_id` | Should be impossible — `(idp_id, external_client_id)` has a UNIQUE constraint in `mows_auth.apps`. Cluster install scripts must use Zitadel's API to discover existing clients before creating new ones. |

## 10. Decision summary

| Question                                                                  | Decision                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Identity provider for v1                                                  | Zitadel, **pluggable** — `idp_id` discriminator allows swapping or adding IdPs later without table rewrite (§2 above) |
| Are user identities stored in MOWS too?                                   | Yes — thin `mows_auth.users` row, JIT-provisioned, keyed by `(idp_id, sub)`    |
| Does every app have a Zitadel identity?                                   | **Yes** — one OIDC client per app (Public+PKCE for SPAs, Confidential+Credentials for backends) |
| Does every API have a Zitadel identity?                                   | **Yes** — confidential client + service user, used for API-to-API calls        |
| Does the authorization engine ever call Zitadel?                          | No. Engine receives `(MowsUser, MowsApp)` already-resolved.                    |
| Does the access token carry authorization claims?                         | No. All authorization lives in `access_policies`. (OPEN_QUESTIONS.md Q7.)      |
| Origin-header check still done?                                           | Yes — as defense in depth on Frontend apps; primary join key becomes `client_id`. |
| Kubernetes SA tokens still accepted for backends?                         | Yes during migration; new backends prefer Zitadel client credentials.          |
| How does a WebSocket auth?                                                | Bearer on the handshake; server re-introspects pre-expiry; closes on expiry.   |
| One Zitadel session per cluster reaches all APIs?                         | Yes — one cluster project, SPAs request multi-API scopes.                      |
| How does filez call realtime under user context?                          | filez's own bearer token + `X-Mows-On-Behalf-Of`. Seed policy authorizes the impersonation. |
| Where do client secrets live?                                             | Kubernetes Secrets, namespace-scoped, rotated via Zitadel UI / API.            |
| What happens to the `mows_auth.apps` sentinel "no-origin" anonymous app?  | Unchanged. Anonymous requests carry no token; this is the only `MowsApp` row without a Zitadel mapping. |
| Federated identity (e.g. user logs in via GitHub)                         | Zitadel handles it. MOWS doesn't see the upstream IdP — only the Zitadel `sub`. |

## 11. What this does NOT solve

- **Multiple identity providers running in parallel.** v1 ships
  Zitadel as the only active IdP. The data model is forward-compat
  via the `idp_id` discriminator (see §2 and DATA_MODEL.md §2.1),
  so a second IdP can be added later without a table rewrite — but
  the install scripts, the manager UI, and the introspector
  registry would all need work before that's usable end-to-end.
- **Cross-cluster identity.** Each cluster has its own Zitadel. A
  user on cluster A is a different `mows_auth.users` row from "the
  same person" on cluster B.
- **Capability tokens that bypass introspection.** Public-link
  capability tokens (OPEN_QUESTIONS.md Q11) are a v2 concern; they'd
  be MOWS-signed and verified locally without Zitadel.
- **Service mesh / mTLS.** The "every API is a Zitadel principal"
  decision deliberately avoids requiring a mesh — but doesn't
  preclude adding one for transport security. Mesh identity ≠ MOWS
  identity; the auth middleware still does Zitadel introspection
  regardless of the transport.
