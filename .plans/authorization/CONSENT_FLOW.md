# CONSENT_FLOW — How third-party apps obtain access

## The OAuth analogy (and the one difference that matters)

The flow mirrors OAuth's "this app wants permission" prompt:

| OAuth                                     | MOWS Consent Flow                                  |
| ----------------------------------------- | -------------------------------------------------- |
| Third-party app redirects user to IdP     | Third-party app embeds the MOWS Picker (iframe)    |
| User sees "GreatApp wants: read your email, send mail" | User sees "Music Player wants: read your file_group **'Holiday Vibes'**" |
| Consent screen lists provider-defined *scopes* | Consent screen lists user-selected *resources*  |
| On approve → IdP issues an access_token   | On approve → MOWS inserts an `access_policies` row |
| Access lasts until refresh-token expiry   | Access lasts until the policy is revoked / expires |
| Apps store an opaque token                | Apps store the `resource_id`(s); the policy row in MOWS is the durable grant |

The key difference: **MOWS scopes are not pre-defined.** The user picks
*which* resource to grant access to, in the same UI that asks for
consent. The picker IS the consent screen — there is no separate
"approve this scope" step where the user might wave through "access
to all your files".

## The actor model

| Actor               | Role                                                                |
| ------------------- | ------------------------------------------------------------------- |
| **User**            | Authenticated via Zitadel. Source of all authority.                 |
| **Third-party app** | A frontend SPA (e.g. Music Player) running on its own Origin.       |
| **Picker**          | A first-party, **trusted** MOWS UI served from the cluster's TLD.   |
| **Service backend** | e.g. filez. Enforces auth via the `check_access` / `list_visible` primitives. |

The Third-party app **never** creates policies. Only the Picker does.
The Third-party app **never** sees raw resource lists it wasn't granted.
A policy row, created via the Picker, is what unlocks subsequent
direct calls from the app's Origin to the service backend.

## The two sub-flows

### A. Picker flow — app needs *some* resource, doesn't know which yet

The dominant case: a music player launches for the first time, needs a
file_group to play.

1. App embeds an iframe to `picker.<cluster-tld>?request=<request-id>`
   and sends the request via `postMessage`:
   ```js
   mowsPicker.request({
       app_origin: location.origin,
       requested_actions: ['FilesGet'],
       allowed_resource_types: ['FileGroup'],
       multi: false,
       purpose: 'to play the music in this folder',
   })
   ```
2. Picker authenticates the user (cookie session — Picker is on the
   cluster's primary origin).
3. Picker shows: resource browser filtered to file_groups the user
   owns or can access, plus a clear consent panel:
   > *Music Player will be able to:*
   > * read files in **Holiday Vibes** (file_group, 38 files)
   >
   > [Allow] [Allow once] [Cancel]
4. On Allow / Allow once, Picker creates one `access_policies` row:
   `subject=User(me), context_app_ids=[music-player.app_id],
    resource_type=FileGroup, resource_id=<picked>, actions=[FilesGet],
    effect=Allow, resource_scope=Single`
   ("Allow once" sets `expires_at = now() + 1 hour`.)
5. Picker `postMessage`s back to the app:
   `{type: 'consent.granted', resource_ids: [...], policy_ids: [...]}`.
6. App stores the `resource_id` (cookie / IndexedDB / its own backend).
7. App calls filez normally — `Origin: music-player.example`, user's
   cookie session — and filez's `check_access(user, music-player,
   File, file_id, FilesGet)` finds the new policy and allows the call.

### B. Permission flow — app already knows the resource

A deep link, a remembered resource, an "open with…" handoff. The
Picker shows only the consent panel — no browser.

```js
mowsPicker.request({
    app_origin: location.origin,
    requested_actions: ['FilesGet'],
    target_resource: { type: 'FileGroup', id: '…uuid…' },
    purpose: 'to import these tracks',
})
```

Picker shows:
> *Music Player will be able to:*
> * read files in **Holiday Vibes** (file_group, 38 files)
>
> [Allow] [Allow once] [Cancel]

Same policy creation as above. No browsing UI — the user only decides
yes or no for the specific resource the app named.

## What gets created — the policy row

Always the **self-owned share** pattern from APP_AUTHORIZATION.md §3:

```
subject_type    = User
subject_id      = <requesting user>
context_app_ids = [<app id>]              -- only this app
resource_type   = <picked>
resource_id     = <picked>                -- one specific resource
resource_scope  = Single                  -- not OwnedByOwner; precisely this
actions         = [<requested>]
effect          = Allow
expires_at      = NULL (standing) or now() + 1h (one-time)
```

Broader scopes (`OwnedByOwner`, `AccessibleByOwner`) are
**deliberately not** offered to third-party apps via the consent
flow. If a user wants a broad grant, they create it explicitly in
the manager UI's "App access" panel. Third-party consent only ever
yields per-resource grants — same shape as Google Drive Picker.

## Revocation

Reuses the existing primitive (no new shape):

- The manager UI's "App access" panel lists every active policy
  whose `context_app_ids @> ARRAY[<app_id>]`.
- "Revoke" sets `revoked = TRUE`. Next `check_access` call from that
  app for that resource returns `DefaultDeny`. The app is gracefully
  evicted on its next request.
- "Revoke all" runs one UPDATE: `revoked = TRUE WHERE owner_id =
  $me AND context_app_ids @> ARRAY[<app_id>]`.
- Auto-expiry by `expires_at` is filtered by the engine; no cleanup
  job needed for correctness.

## Security properties

| Property                                  | How it's enforced                                |
| ----------------------------------------- | ------------------------------------------------ |
| Only the Picker creates policies          | The Picker is the only app with the type-level `AccessPoliciesCreate` permission on behalf of any user. Third-party apps lack it. |
| App can't escalate scope post-consent     | The granted policy is `Single`-scope on one resource. Calling filez for *another* resource still requires a separate consent. |
| App can't impersonate the Picker          | Origin check — the Picker runs at the cluster's TLD; third-party apps run on different Origins. The `apps.origins[]` enforcement is unchanged. |
| Apps cannot read resources not yet consented to | `check_access` finds no allow policy → `DefaultDeny`. |
| Picker iframe can't be spoofed            | postMessage `event.origin` is verified to be the cluster TLD. The picker SDK runs in the app's origin and only accepts messages from the picker origin. |
| User sees what's being granted, plainly    | The consent panel lists the actions in human terms (translated by `MowsContext.t.actions[…]`) and the resource by name + count of contained items. |
| Phishing — fake picker UI                 | The Picker is on a well-known origin (cluster TLD). Users learn to recognise it the way they learn to recognise their bank's domain. Future: add a personal "consent indicator" string the user set once, displayed by every consent dialog. |
| CSRF on the policy-create call            | The Picker uses standard same-site cookie + CSRF token. The third-party app never directly hits the policy-create endpoint. |

## Trust gradient

| App type                          | What it can do                                      |
| --------------------------------- | --------------------------------------------------- |
| Anonymous / unknown Origin        | Only `Public` policies apply.                       |
| Registered third-party app        | Must obtain per-resource consent via the Picker.    |
| First-party app (manager UI, filez UI, Picker) | `trusted = TRUE`. Owner short-circuit. Can create policies via the manager. |
| Backend job pickup app (filez worker, …) | Acts on behalf of a user who created a job. Inherits the user's permissions for that job's scope. |

## JS SDK — sketch

```ts
import { MowsPicker } from '@mows/picker-sdk';

const picker = new MowsPicker({
    clusterOrigin: 'https://mows.example.com',
});

const result = await picker.request({
    requested_actions: ['FilesGet'],
    allowed_resource_types: ['FileGroup'],
    multi: false,
    purpose: 'to play the music in this folder',
});

if (result.type === 'granted') {
    localStorage.setItem('music_lib', JSON.stringify(result.resource_ids));
    // …now call filez normally; the policy is in place.
} else {
    showCancelMessage();
}
```

The SDK opens an iframe (or popup, configurable), handles
`postMessage` plumbing, validates origin, and surfaces a Promise.
No app touches the policy table directly.

## What this requires in the engine

Nothing new architecturally. The Picker just creates ordinary
`access_policies` rows; the engine evaluates them via the same
`check_access` primitive. The only new artefacts are:

1. The **Picker UI** — a first-party SPA served from the cluster TLD.
2. A **PolicyCreateForRequestor** action that the Picker (and only
   the Picker) holds at the type level. Other apps explicitly do
   not have this action.
3. The **Picker JS SDK** — a small npm package handling postMessage
   plumbing and the request shape.

Everything else — the policy storage, the per-app check, the
revocation UX, the audit log — is already covered by the existing
design.

## Comparison to OAuth, summarised

- **No bearer tokens.** MOWS uses session cookies for the user and
  Origin headers for the app. The "token" is the existence of a row.
- **No refresh.** Policies are durable until revoked / expired.
- **No scope strings.** Scopes are `(resource_type, action[])` tuples;
  every action is a known integer in the engine.
- **No discovery endpoint.** The Picker is the discovery — user
  browses what they own, app gets what user picks.
- **Consent UI is the picker.** No separate "review scopes" step;
  the granted scope is exactly the resource the user clicked.
- **Revocation is row-level.** Same `revoked` flag the rest of the
  system uses; no separate revocation endpoint shape per app.

The result is that "third-party app integration" reduces to two new
artefacts (Picker + SDK) and zero new primitives. Same engine, same
RLS, same audit trail.
