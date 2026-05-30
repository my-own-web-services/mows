# authz-admin

Cross-service authorization admin BFF for MOWS (Phase 7 of the
authorization initiative). Aggregates `/api/access_policies/*`
surfaces across consumer services (realtime, filez, …) so a single
operator UI can answer "who can see what + why" without a per-service
tab.

## Why a separate cluster service?

The first sketch put this UI inside the MOWS *manager*. That was
wrong: the manager is bootstrap + lifecycle infrastructure (nodes,
clusters, VMs); operational dashboards belong on the cluster itself
and are routed through traefik like any other web app. The
correction is logged in `.plans/authorization/PLAN.md` §"Phase 7"
and `.plans/authorization/ROADMAP.md` §"Phase 7".

## Layout

- `server/` — Rust + axum BFF. Holds no database; speaks HTTP to
  upstream consumer services. Crate name `authz-admin-server`,
  workspace-registered.

A React SPA at `apps/web/` will land in a follow-up commit; it
consumes only this BFF (not the consumer services directly).

## Configuration

| Env var | Default | Purpose |
| --- | --- | --- |
| `LISTEN_PORT` | `8080` | TCP listen port |
| `BIND_ADDRESS` | `0.0.0.0` | Bind address |
| `REALTIME_BASE_URL` | _(unset)_ | Upstream realtime-server base URL. Unset → that upstream is disabled. |
| `FILEZ_BASE_URL` | _(unset)_ | Upstream filez-server base URL. Unset → that upstream is disabled. |

`authz-admin` refuses to start with zero upstreams — a deploy with
nothing to aggregate is always a misconfiguration.

## Endpoints (current)

- `GET /api/health` — process liveness.
- `GET /api/upstreams` — list configured upstreams with a parallel
  reachability probe against each one's `/api/health`.

The aggregating `/api/access_policies/explain` endpoint lands in the
next commit; the React SPA after that.
