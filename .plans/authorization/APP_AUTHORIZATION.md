# APP_AUTHORIZATION — Apps as a context dimension

IDEA.md §Apps:

> Apps can access objects in combination with a user account or without an
> account if a user allowed for the access of the object without an account
> with the app in question

This document explains how apps are identified, what `trusted` means, and
how the four user-app share flavours from IDEA.md §AccessPolicies map onto
the engine.

## 1. App identity

Authoritative reference: **AUTHENTICATION.md §3 — every app has a
Zitadel principal**. Summarized:

1. **Frontend apps** — Zitadel Public OIDC clients (Code + PKCE). The
   access token carries the SPA's `client_id`; the middleware joins
   on `apps.external_client_id` to resolve the `MowsApp` row. The
   browser `Origin` header is cross-checked against
   `apps.origins TEXT[]` as defense in depth. `app_type = Frontend`.
2. **Backend apps** — Zitadel Confidential OIDC clients (Client
   Credentials). Same join on `external_client_id`. The legacy
   Kubernetes service-account-token path is still accepted during the
   migration window (AUTHENTICATION.md §8) and resolves to the same
   `MowsApp`. `app_type = Backend`.
3. **APIs calling APIs** — also Zitadel Confidential OIDC clients
   (`app_type = Api`), introduced so cross-API calls (e.g. filez
   posting an event to the realtime API) use the same identification
   mechanism as everything else (see AUTHENTICATION.md §3.4 and §6.4).

If no token is presented, the request is anonymous and uses a
sentinel "no-origin" app with `id = nil_uuid`. This is the only
`MowsApp` row without a Zitadel mapping; it's the path for fully
public access to resources marked `subject_type = Public`.

The shared crate moves the resolution code as-is and exposes
`MowsApp::resolve(...)` — the new Zitadel-`client_id` lookup is one
Diesel query swap with the old origin lookup as the fallback during
migration.

## 2. `trusted` flag

`apps.trusted = TRUE` causes one and only one short-circuit:
**when the requesting user is the owner of every requested resource, the
check returns Allow without consulting the policy table.**

Trusted apps:

- the manager UI (first-party, runs on the same TLD as the MOWS server)
- per-service first-party UIs (filez UI, future calendar UI, …)

Trust is administrator-granted at app registration time. The trust does
*not* give the app any rights it didn't earn — it only lets the engine skip
policy lookups for the owner's own data. Crucially, a trusted app acting
on behalf of user U cannot touch resources owned by V via the short-circuit
alone; for that it needs an explicit policy.

The short-circuit is the ONE bypass in the engine. We keep it because:

- it cuts the round-trip on every "my own files" call in the first-party
  UI (the hottest path),
- it preserves the invariant that explicit Deny still wins (no untrusted
  app is ever short-circuited),
- the alternative — synthesising an implicit-Allow policy at user creation
  time — bloats the policy table by O(users × apps) rows.

## 3. The four IDEA.md "self-owned" sharing patterns

> Self owned
> - A user can allow an app to use a self-owned object
> - A user can allow an app to use all objects in a self-owned Group
> - A user can allow an app to use all of the objects they have access to

These three map to access_policy rows owned by the user (`owner_id = user`)
with `subject_type = User, subject_id = user`, and varying `resource_scope`:

| IDEA pattern                                  | Row shape                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| App may use one self-owned object             | `subject=User(me)`, `context_app_ids=[App]`, `resource_type=T, resource_id=X, scope=Single` |
| App may use everything in a self-owned group  | `subject=User(me)`, `context_app_ids=[App]`, `resource_type=ResourceGroup(T), resource_id=G, scope=Single` (via the resource-group path) |
| App may use everything in a self-owned *bag*  | `subject=User(me)`, `context_app_ids=[App]`, `resource_type=T, resource_id=NULL, scope=OwnedByOwner` |
| App may use everything I have access to       | `subject=User(me)`, `context_app_ids=[App]`, `resource_type=T, resource_id=NULL, scope=AccessibleByOwner` |

All four work today's engine + the two NEW scopes (DATA_MODEL.md §2.4,
POLICY_SEMANTICS.md §4).

The reason these are `subject=User(me)` and not just trust-the-app: the
user retains control. Revoke = delete one row; the app instantly loses
access on next check.

## 4. The four IDEA.md "shared" patterns

> Shared
> - A user can share an object with another user to use with a specific
>   App, a list of apps or any app
> - A user can share an object with a user group to use with a specific
>   app or a list of apps or any app
> - A user can share an object with everyone that is registered on the server
> - A user can share an object with the public no matter if logged in or not

Map cleanly to:

| Pattern                                              | Row shape                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Share R with user V for specific app A               | `subject=User(V)`, `context_app_ids=[A]`, `resource_id=R`                                  |
| Share R with user V for list of apps                 | `subject=User(V)`, `context_app_ids=[A1, A2, …]`, `resource_id=R`                          |
| Share R with user V for any app                      | `subject=User(V)`, `context_app_ids=[nil_uuid]`, `resource_id=R`                           |
| Share R with user group G for specific app A         | `subject=UserGroup(G)`, `context_app_ids=[A]`, `resource_id=R`                             |
| Share R with all server members                      | `subject=ServerMember`, `context_app_ids=[…]`, `resource_id=R`                             |
| Share R with the public, including anonymous         | `subject=Public`,        `context_app_ids=[…]`, `resource_id=R`                            |

The "any app" sentinel `nil_uuid` is described in DATA_MODEL.md §3.1. We
keep apps explicit (instead of a separate boolean `any_app`) because the
GIN index on `context_app_ids` already covers both queries with one shape.

## 5. Account-less app access

> Apps can access objects in combination with a user account or without an
> account if a user allowed for the access of the object without an account
> with the app in question

This is the precise meaning of `subject_type = Public` AND
`context_app_ids` constrained:

- `subject=Public, context_app_ids=[]` is meaningless (we forbid empty
  context_app_ids — DATA_MODEL.md §4 invariant 1).
- `subject=Public, context_app_ids=[nil_uuid]` = "anyone via any app" — a
  truly public link.
- `subject=Public, context_app_ids=[A]` = "anyone via app A". This is the
  IDEA-line: a user shares a resource so that App A may access it without
  any user account, but no *other* app may.

When `requesting_user = None` and the engine matches a row of this shape,
the app is allowed. The engine already handles this branch (filez
`check_resources_access_control`'s `None` arm of `match
maybe_requested_resource_ids` and the `Public` filter in the macro).

## 6. Apps as resources themselves

Apps appear in the resource registry as `AccessPolicyResourceType::MowsApp`
(already in filez), so policies *about apps* are possible:

- "Paul may register new apps" — `subject=User(Paul),
  resource_type=MowsApp, resource_id=NULL, action=AppsCreate`.
- "Only admins may mark apps trusted" — implementation note: the
  `trusted` flag is an admin-only mutation; the `AccessPolicyAction`
  `AppsMarkTrusted` is granted only to SuperAdmins by default.

## 7. App revocation

A user (or an admin) revoking app access has two grain sizes:

- **Per-policy.** `UPDATE access_policies SET revoked = TRUE WHERE id =
  X`. Preserves audit history. The check engine's partial indexes already
  skip revoked rows.
- **App-wide.** "Revoke *all* access I've ever granted to App A." One
  SQL: `UPDATE access_policies SET revoked = TRUE WHERE owner_id = me
  AND context_app_ids @> ARRAY[A]`. A first-party UI surface for this is
  important — users should be able to undo a broad share they
  retrospectively regret.

App revocation is fast (one UPDATE), reversible (`revoked = FALSE`), and
shows up in the next check.

## 8. Multi-app contexts on a single policy

`context_app_ids[]` allows N apps per policy. The semantics are *OR* —
the policy applies if the requesting app is *any* of them.

If a user wants the equivalent of "App A AND App B" (i.e. only when both
participate, never just one), that's a different concept (a *capability
chain*), and we do not support it in v1. The user creates two separate
policies if they need conjunction semantics; or, equivalently, they
specify the narrower of the two apps as the policy's audience.

## 9. App trust is a deployment-time decision

The `trusted` flag is set during app onboarding:

- First-party apps (manager UI, filez UI, …) are seeded `trusted=true` by
  the same `MowsPackageManager` manifest that installs them. Their
  service-account or origin is well known.
- Third-party apps are `trusted=false` by default. Admins can promote
  them but this should be rare and audited.

We do not let *users* mark apps trusted. The IDEA.md text suggests
self-ownership grants of "all my objects to App A" — that is the
`OwnedByOwner` scope (§3 above), and it's the right shape: revocable,
auditable, per-user, scoped to one resource type at a time.

## 10. Test plan for app authorization

- Trusted-app short-circuit fires exactly when all requested resources
  are owned by the requesting user and the app is trusted, and not
  otherwise. Cover both: a trusted app may not access another user's
  resources without a policy.
- The `nil_uuid` "any app" sentinel matches in both `direct` and
  `via_group` query branches.
- Account-less access: anonymous request + `Public` policy with a
  specific app context = Allow only for that app, Deny for any other app
  or anonymous-without-app.
- Revocation: per-policy and app-wide revocation immediately drop access
  on the next check call.
- Service-account-token rejection: a frontend app's service-account
  token must be rejected (it has `origins IS NOT NULL`); filez already
  enforces this — port the test.
