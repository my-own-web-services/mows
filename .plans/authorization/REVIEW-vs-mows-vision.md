# REVIEW — auth design vs. MOWS vision (mows.cloud)

Multi-perspective gap analysis run 2026-05-26 cross-checking the
authorization/authentication design against the MOWS project vision
in `website/src/pages/project/`. The website is the rendered version
of those source files (it's an SPA, so WebFetch returns only the
shell — sources are authoritative).

## Status legend

- ✅ resolved by the changes in this PR
- 🟡 acknowledged, deferred or scope-reduced (with note)
- ❌ open, not yet addressed
- ➖ noted but the website itself is the wrong side and will be
  corrected later — no action in the auth design

## Findings — resolution table

| ID         | Severity | Status | Resolution                                                                 |
| ---------- | -------- | ------ | -------------------------------------------------------------------------- |
| MISALIGN-1 | Critical | 🟡     | Federation deferred (user: "not that important for auth"). Per-cluster assumptions stay; no forward-compat `cluster_id` discriminator. Website's "Federation Cloud API" is out-of-date. |
| MISSED-1   | Critical | ➖     | "Operator" no longer exists as a MOWS part (website out of date). Pektin and Verkehr are backend-only concerns and remain out of v1 auth scope. |
| MISSED-2   | Critical | 🟡     | Reduced — admin is the only one who can install apps for now. APP_AUTHORIZATION.md gains an admin-only install/update/uninstall section; full per-user app installation is v2. |
| MISALIGN-2 | Major    | ❌     | Boot-phase Manager auth still undocumented. Out of scope for this round. |
| MISSED-3   | Major    | 🟡     | Reduced by admin-only scope. The set of admin-only actions (install app, add user, set user_type, decryption secret) is small and gets noted in APP_AUTHORIZATION.md. |
| MISALIGN-3 | Major    | ✅     | Adding `idp_id` discriminator on `users.external_user_id` and `apps.external_client_id` so a second IdP can land without table rewrite. Zitadel-specific schema concepts (`external_client_id` UNIQUE alone) are replaced by `(idp_id, external_*_id) UNIQUE`. |
| MISALIGN-4 | Major    | ✅     | Bearer-token forwarding between APIs struck from AUTHENTICATION.md §6.4. Only the on-behalf-of path remains. |
| GAP-1      | Major    | ❌     | Household scoping — defer; UserGroup is sufficient for v1 with a worked example. |
| GAP-2      | Major    | ❌     | Generic engine claim only validated against filez today. Worth walking Secrets / Payment through the contract before v2. |
| GAP-3      | Major    | ❌     | Service discovery + standard `GET /me/grants` endpoint shape — defer; manager UI hardcodes for v1. |
| RISK-1     | Major    | ❌     | Minimum-footprint Postgres profile — defer. |
| GAP-4      | Minor    | ❌     | Offline-first authenticated mutations — defer; v1 = optimistic-then-sync. |
| GAP-5      | Minor    | ➖     | Website conflates "Auth API" with Zitadel; auth design is correct, the website needs a one-line tweak. |
| GAP-6      | Minor    | ❌     | Owner-less infra resources — defer; convention = system_user as owner. |
| MISSED-5   | Minor    | ❌     | Static-IP relay VM as a principal — defer. |
| MISSED-6   | Minor    | ❌     | Secrets Cloud API model — defer. |
| RISK-2     | Minor    | ❌     | RLS template safety test — Phase-1 implementation task. |
| MISALIGN-4i| Minor    | ❌     | Picker i18n — defer. |
| RISK-3     | Minor    | ❌     | Picker compromise blast radius — defer; already partially mitigated by DB role split. |

## Full review report

What follows is the full agent report verbatim. The vision summary is
useful as a one-stop quote-base; the per-finding citations point at
the website source files.

---

## MOWS Vision Summary (from mows.cloud sources)

- **Sovereignty & privacy are the moral spine** — `Hero.tsx:18-19`;
  whole `Story.tsx` "Privacy" / "Sovereignty" / "Openness" sections.
- **Five parts on the website (out of date)**: Operator, Manager,
  Hardware, Cloud APIs, Apps — `FiveParts.tsx:34-37`. **Operator is
  no longer a separate part per the user's confirmation.**
- **Manager** owns setup / decryption / add-remove-nodes / recovery;
  holds the master secret string. Without the secret the cluster
  cannot be decrypted — `FiveParts.tsx:74-145`.
- **Cloud APIs named on the site**: Filez, Auth (Zitadel-based),
  Notification, Realtime, AI, Federation, Collaboration, Monitoring,
  Payment, Maps, User Config, Secrets — `CloudAPIs.tsx:11-88`.
- **Apps are installable** with a manifest of recommended/minimum
  resources; admin reviews and approves — `FiveParts.tsx:253-260`.
  Not limited to one central app store — `Story.tsx:546-549`. Apps
  "run completely isolated by default" — `Story.tsx:548-549`.
- **Cluster can be shared** with friends / family — `FAQ.tsx:30`;
  also positioned for small businesses — `FAQ.tsx:22`.
- **Three-machine minimum, runs on consumer hardware, scales down to
  one** — `Differences.tsx:78-86`, `FAQ.tsx:29-30`.
- **Full encryption at rest** — `Differences.tsx:28-31`.
- **Cluster-of-clusters / federation hinted** — backups on another
  person's cluster `FiveParts.tsx:309-313`; `Federation` Cloud API
  exists.
- **Offline-first, LAN-resilient** — `FAQ.tsx:41-42`.
- **VMs are first-class** — Kubevirt; gaming, foreign-OS streaming.
- **AGPLv3, no vendor lock-in, self-hostability without external
  dependencies** — `Differences.tsx:48-55`.

## What's accepted as out-of-scope / scope-reduced for v1 auth

Per the user's resolution:

1. **No federation in v1.** The Federation Cloud API on the website
   is forward-looking. The auth model assumes one cluster, one
   Zitadel instance, one universe of identities. v2 may revisit.
2. **No Operator-as-a-MOWS-part.** Pektin (DNS) and Verkehr (TLS /
   ingress) are backend infrastructure. They are not consumers of
   mows-auth-core in v1; their own RBAC remains internal. The auth
   design no longer needs to model DNS zones, ingress routes, etc.
3. **Apps are installed by the admin only.** No per-user app
   installation in v1. The Picker's bundle-consent flow still
   applies *at install time*; runtime per-resource consent still
   uses the standard CONSENT_FLOW.md Picker.
4. **Zitadel is the v1 IdP but not baked in.** The schema gains a
   single `idp_id` column on `users` and `apps` so a second IdP
   (Keycloak, Authentik, …) can land without rewriting tables.

## Open findings worth revisiting

- **MISALIGN-2 (boot-phase auth)** — when the cluster is encrypted
  and Postgres/Zitadel are not yet up, the Manager authenticates the
  human providing the decryption secret. That trust path is its
  own thing, intentionally separate from mows-auth-core. Document
  when the Manager design firms up.
- **GAP-2 (engine generic against ≥2 services)** — filez is the
  first consumer. Walk one of the unusual ones (Secrets, Payment,
  realtime presence) through the extension contract before v2.
- **GAP-3 (service discovery)** — the manager UI hardcodes the list
  of services for v1. Add a service-registry mechanism when the
  third Cloud API lands.

## Sharpest open question post-resolution

> **What does "an app" mean in v1 if only the admin installs them?**
> If only the admin installs, the consent-at-install flow is just
> the admin reviewing what the manifest asks for and approving. The
> Picker's third-party-SPA mode (CONSENT_FLOW.md) becomes a
> v2-deferred concern, and the per-user share flow ("share this
> file group with this app") remains as the only runtime Picker
> path. Worth a short clarifying section in APP_AUTHORIZATION.md.
