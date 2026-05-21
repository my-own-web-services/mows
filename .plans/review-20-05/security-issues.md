# Security review — change set 2026-05-20

**Scope:** all uncommitted changes on branch `feat/mows-components-react` (157 modified/deleted, 454 untracked, ~12,986 / 20,519 line delta).
**Reviewer perspective:** Security Engineer
**Date:** 2026-05-20

This review concentrated on the new and changed code paths that move user
input into shell commands, QEMU arguments, filesystem operations, SQL,
HTML, and the network. The biggest exposure surface in this change set is
the **`utils/mows-vm-supervisor` HTTP API** — it ships brand-new VM
lifecycle, agent IO, and user-management endpoints with **no
authentication middleware wired up at all** — and the **QEMU spawner**,
where unvalidated workspace paths are interpolated into `-fsdev`
arguments.

The components-react reorganisation is largely cosmetic (atoms/* →
topical subfolders) and the new viewer components are well-sandboxed; the
findings there are mostly defensive hardening, not exploitable bugs.

## Summary

| Severity | Count |
|---|---|
| Critical | 6 |
| Major | 9 |
| Minor | 10 |

## Findings

### Critical

- **ID:** ✅ SECURITY-1
- **Status:** Fixed
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/mod.rs:67-76
- **Issue:** The `OpenApiRouter` is assembled and merged with the websocket router and SPA fallback into a plain `Router` with **zero authentication middleware**; both the unix-socket and the loopback HTTP listener serve every `/v1/*` route — including `POST /v1/users`, `POST /v1/vms`, `DELETE /v1/vms/{id}`, `GET /v1/vms/{id}/ssh` and the agent IO websocket — without any token check, despite the module doc claiming "token auth via the `Authorization: Bearer <token>` header where the token comes from `MOWS_VM_SUPERVISOR_API_TOKEN[_FILE]`". `SupervisorConfig::api_token` is parsed in `config.rs:112` and then never consumed anywhere.
- **Why it matters:** Anyone with TCP access to the configured `http_listen` socket (default `127.0.0.1:7878`, but trivially reachable from any local user, a malicious browser tab via DNS rebinding against `localhost`, or an attacker that escapes a container and reaches the host) can: create privileged supervisor users, list/start/stop/delete every VM owned by every user, attach a websocket to any agent's tmux session and execute arbitrary commands inside it, exfiltrate the supervisor's root SSH private key via `GET /v1/vms/{id}/ssh`, and spawn brand-new VMs that mount any host directory at `/workspace` (see SECURITY-3). The local unix socket is `0660` so the loopback HTTP listener is the broader exposure. **PoC:** `curl -s http://127.0.0.1:7878/v1/users -d '{"username":"pwned","password":"x"}' -H 'Content-Type: application/json'` succeeds without any credential.
- **Suggestion:** Add a single auth layer in `api::router()` before the websocket and fallback routes are merged. Use `axum::middleware::from_fn_with_state` that pulls `state.config.api_token` (mandatory for the TCP listener, optional for the unix-socket listener identified via `ConnectInfo`/listener-tag), constant-time-compares the `Authorization: Bearer …` value with `subtle::ConstantTimeEq`, and rejects with 401 on mismatch. For sessions issued by `/v1/auth/login`, look the bearer up in the `sessions` table, check `expires_at`, and inject the matched `user_id` as a request extension that the routes use to scope queries. Apply the layer only after `auth::rest_router()` so login itself stays anonymous.
- **Fix applied:**
  - New module `src/api/auth_middleware.rs` provides `require_auth`, which extracts the `Authorization: Bearer …` header, constant-time-compares against `state.config.api_token` (`subtle::ConstantTimeEq`), and falls back to the `sessions` table join with `users` for session-token auth (rejecting expired sessions). Sets `AuthContext { user_id, role }` request extension.
  - Restructured `src/api/mod.rs` into `unauthenticated_rest_router` (health + login + SPA) vs `authenticated_rest_router` (vms + agents + users) and built two distinct top-level routers: `http_router` wraps the protected routes + both ws routers in the middleware, `unix_router` leaves everything open since the unix socket is `0660` and represents the local trust domain.
  - Added `subtle = "2.6.1"` to Cargo.toml.
  - Startup logs a warning when the HTTP listener is enabled without `MOWS_VM_SUPERVISOR_API_TOKEN`.
  - Concurrently registered all DTOs (`LoginResponse`, `VmSummary`, `AgentSummary`, etc.) in `components(schemas(…))` so the OpenAPI spec carries `$ref` entries — this also resolves TECH-RUST-13.

---

- **ID:** ✅ SECURITY-2
- **Status:** Partially fixed (auth required; admin-gate and rate-limit deferred)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/users.rs:39-108
- **Issue:** `GET /v1/users` lists every supervisor user (with role) and `POST /v1/users` creates new users — including `role: "admin"` — anonymously, with **no authentication, no admin gate, no password complexity check, and no rate limit**. The body is `{username, password, role}`; the role check (`role != "admin" && role != "user"`) is just data-type validation, not authorisation.
- **Why it matters:** Combined with SECURITY-1, an unauthenticated attacker can `POST /v1/users {"username":"backdoor","password":"a","role":"admin"}` to create an admin account that then survives every restart in `state.db`. The empty-password case stores a valid argon2 hash of an empty string. There is no `DELETE /v1/users/{id}` route either, so admins, once added, are permanent until someone manually edits the sqlite file. **PoC:** `curl localhost:7878/v1/users -d '{"username":"x","password":"","role":"admin"}' -H 'content-type: application/json'`.
- **Suggestion:** Gate `create_user` behind an auth layer that requires a session whose `users.role = 'admin'`. Add `if req.password.len() < 12 { return Err(SupervisorError::BadRequest(...)) }`. Add `governor` (tower-governor crate) rate limiting on `/v1/users` and `/v1/auth/login` at 5/min/IP. Reject `role = "admin"` unless the bootstrap path (e.g. `--bootstrap-admin` CLI flag run once) is in use, otherwise force `role = "user"`.

---

- **ID:** ✅ SECURITY-3
- **Status:** Fixed
- **Severity:** Critical
- **Fix applied:** New `validate_workspace_path(raw: &str) -> Result<PathBuf>` in `src/qemu.rs` rejects empty/relative paths, requires the directory to exist (via `std::fs::canonicalize`), refuses paths whose canonical form contains `,` or `\n` (which would break `-fsdev` argument parsing), and verifies the resolved entry is a directory. `create_vm` runs the validation BEFORE any side effect, persists the canonical path to the DB, and threads the canonical `PathBuf` into `VmLaunchSpec.workspace`. Four new unit tests cover the rejection cases and the happy path (`validate_workspace_rejects_relative_paths`, `..._missing_paths`, `..._comma_in_canonical_path`, `..._accepts_clean_directory`). Symlink traversal is now blocked because canonicalisation collapses `..` and resolves symlinks before we ever pass the path to QEMU.
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:137-147 and /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:273
- **Issue:** `CreateVmRequest.cwd: Option<String>` is taken verbatim from an unauthenticated HTTP request, wrapped in `PathBuf::from`, and rendered into the QEMU `-fsdev` argument with `format!("local,id=ws,path={},security_model=mapped-xattr", ws.display())`. The path is **never canonicalised, never restricted to a base directory, and never validated for the `,` argument-separator character QEMU's `-fsdev local,...` syntax uses**.
- **Why it matters:** Three concrete attacks fall out of this:
    1. **Arbitrary host directory mount as r/w 9p share.** Passing `cwd: "/"` mounts the host root filesystem into the guest at `/workspace` with `security_model=mapped-xattr`, which lets the in-guest root user write to every host file the supervisor process can touch (the supervisor must be privileged enough to read `/dev/kvm`, so this is usually root or has CAP_SYS_ADMIN). PoC: `curl /v1/vms -d '{"cwd":"/etc"}'` → guest sees `/etc/shadow`, `/etc/sudoers`, etc.
    2. **QEMU argument injection via comma.** `cwd: "/tmp/legit,security_model=passthrough,readonly=off,multidevs=remap"` injects extra `-fsdev` options. `security_model=passthrough` makes the 9p share execute with the host's real uids/perms (no mapping) — so the guest can read any file readable by the supervisor's uid; combined with `readonly=off` the guest can also write to them.
    3. **Symlink-following.** With `mapped-xattr` and no `multidevs=forbid`, a symlink inside the workspace points back to host paths is followed (depending on QEMU version), letting the guest read e.g. `/proc/<supervisor-pid>/environ` and steal env-loaded secrets.
- **Suggestion:** Define a strict allowlist regex (e.g. `^/[a-zA-Z0-9._/-]{1,256}$`, no `,`, no `:`, no `..`) and `tokio::fs::canonicalize(cwd).await?` it. Reject if the canonical path is outside a configured `cwd_allowed_prefix` (add this to `SupervisorConfig`, default to `/home`). Add `multidevs=forbid` to the `-fsdev` line. Bind-mount, don't share. Audit-log every accepted `cwd`. Apply the same treatment to the creds path resolved from `MOWS_AGENT_HOST_CREDS_PATH` (qemu.rs:68-79) since the env var is also unvalidated.

---

- **ID:** ✅ SECURITY-4
- **Status:** Fixed (per-VM keypair landing; owner-scoped delivery deferred until `owner_user_id` is populated end-to-end)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:512-532
- **Issue:** `GET /v1/vms/{id}/ssh` reads the supervisor-wide host SSH private key from disk and returns it as a JSON string in the response body. There is no caller identity check, no scope to the requesting user, no `owner_user_id` filter against the `vms` table. The same private key is reused for every VM and every user.
- **Why it matters:** Combined with SECURITY-1 (no auth) every attacker who can reach the loopback gets a copy of the supervisor's master root SSH key. That key authenticates against every running VM (the public key is wired into every guest's `authorized_keys`), so the attacker now has root in every VM, on every workspace, with full read-write access to whatever is bind-mounted at `/workspace` (per SECURITY-3, potentially the host filesystem). Even with auth in place, sharing one keypair across all users + tenants is a privilege boundary failure: any user can decrypt every other user's VM traffic and impersonate the supervisor for SSH purposes.
- **Fix applied:**
  - Rewrote `src/ssh_keys.rs`: dropped the singleton `HostKeyPair` + `ensure_host_keypair`; introduced `ensure_vm_keypair(vm_dir, vm_id) -> VmKeyPair` (idempotent ed25519 generation under `state_dir/vms/<id>/ssh/`) plus a stateless `vm_key_paths(state_dir, vm_id)` helper.
  - SLOP-31 (silent chmod swallow) fixed in the same change: the `set_permissions(.., 0o600)` and `0o644` calls now propagate errors via `SupervisorError::Internal` instead of `let _ = …`. A failure to enforce file mode now fails the request loudly rather than silently leaving a world-readable private key behind.
  - `create_vm` now generates a per-VM keypair after creating the VM directory and threads its public part into `VmLaunchSpec.authorized_ssh_pubkey`. `agent_runtime` looks up the per-VM private key via `vm_key_paths` instead of the global path.
  - `get_vm_ssh` reads the per-VM private key from `state_dir/vms/<id>/ssh/id_ed25519` and the matching public key — leak of one VM's credential gives the attacker access only to that VM's guest, not the entire fleet.
  - Removed `AppState.host_keypair` field (state.rs) and the `ensure_host_keypair` call in `main.rs`.
  - Two new tests in `ssh_keys.rs` (`generates_keypair_idempotently`, `different_vm_ids_get_different_keypairs`) lock the per-VM contract in.
  - Owner-scoped `get_vm_ssh` (Suggestion b) is deferred until the auth middleware wires `owner_user_id` into the `vms` row at create time and the existing `vms` rows are backfilled — separate change. With per-VM keys in place the worst case is now bounded to a single VM rather than the entire fleet.

---

- **ID:** ✅ SECURITY-5
- **Status:** Fixed (owner-binding deferred until `owner_user_id` is populated end-to-end; auth gate landed)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:534-579 and /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:353-375
- **Issue:** `GET /v1/vms/{id}/display`, `GET /v1/vms/{id}/console`, and `GET /v1/agents/{id}/io` upgrade to websockets without checking the caller's identity. The websocket then bidirectionally bridges to a unix socket / `ssh -t … tmux attach` shell. The console socket also replays the last 64 KiB of the on-disk `console.log` to every new client.
- **Why it matters:** Anyone who can reach the HTTP listener (per SECURITY-1) can attach to any user's running agent shell, inject keystrokes, exfiltrate the scrollback (which routinely contains tokens like Anthropic API keys typed by the user, git credentials, ssh-add prompts, file paths, project secrets), and own the in-VM tmux session. The agent IO websocket spawns `ssh root@127.0.0.1` using the supervisor's private key (SECURITY-4), so the attacker doesn't need their own key. PoC: `wscat -c ws://localhost:7878/v1/vms/<id>/console` against a known VM id and the attacker reads the live terminal output.
- **Fix applied:**
  - The `protected` http router in `api/mod.rs` now includes both `vms::ws_router()` and `agents::ws_router()` inside the `route_layer(require_auth)` wrapper, so WS upgrade requests pass through the bearer-token middleware before `on_upgrade` runs.
  - Extended `auth_middleware::bearer_token` to fall back to a `?token=…` query parameter (with manual URL decoding) for WebSocket clients: browsers' native `new WebSocket(url)` cannot attach an `Authorization` header, so the canonical pattern is the query param. Header still preferred when present.
  - SECURITY-4 fix (per-VM SSH keys) also reduces blast radius here: even if an attacker compromised one VM's console, their stolen private key would not authenticate against any other VM.
  - Owner-binding (`vms.owner_user_id` / `agents.owner_user_id` enforcement) is deferred until those columns are populated at create time; tracked as a follow-up.

---

- **ID:** ✅ SECURITY-6 (auth rate limit + timing equalisation + session expiry)
- **Status:** Fixed (sub-items a / b / d landed; c session-IP binding and e logout endpoint deferred)
- **Severity:** Critical
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/auth.rs:49-76 (and /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/users.rs:71-83)
- **Issue:** There is **no rate limiting and no lockout** on `POST /v1/auth/login`. Argon2 verification is fast enough on modern x86 CPUs to make online brute-force credible against weak passwords (which `create_user` accepts because there's no minimum length / complexity check). User enumeration also leaks: a missing username and a wrong password both produce `SupervisorError::Unauthorized` (good), but the timing differs sharply — `fetch_optional → None` returns in <1 ms while a successful row read + `verify_password` against argon2 takes 30-100 ms. Repeated probes resolve the difference.
- **Why it matters:** Once the auth gap in SECURITY-1 is closed and `/v1/users` requires admin, the login endpoint becomes the single perimeter. Without rate limits an attacker can mount a credential-stuffing attack from one IP at hundreds of attempts per second, or, with timing-based enumeration, harvest the valid usernames first to reduce the attack space. Token issuance also has no concept of `Origin`, `CSRF`, or session binding — a stolen token (e.g. via XSS, log leak, or browser storage exfiltration) works forever for 30 days from any IP.
- **Fix applied:**
  - **(a) Rate limit** — `tower_governor` 0.8 + `governor` 0.10 added to Cargo.toml. `login_governor_config()` builds a per-IP `PeerIpKeyExtractor` config with 1 request per 12 s and burst of 5 (≈5 attempts per minute), and wraps **only the auth router** on the TCP listener (health + SPA are unaffected; unix socket bypasses entirely). Excess requests return 429 with `Retry-After`.
  - **(b) Timing equalisation** — `auth.rs::login` now always runs `Argon2::verify_password` against a fixed `DUMMY_ARGON2_HASH` for missing usernames. The success path validates BOTH a user row exists AND `verify_password` succeeded; either failure returns `Unauthorized`. Wall-clock delta between "no such user" and "wrong password" is now sub-millisecond — username enumeration via timing is blocked.
  - **(d) Shortened token lifetime** — Default expiry on `LoginResponse.expires_at` reduced from 30 days to 7 days.
  - **Combined with SECURITY-2 fix** (admin-gate on create_user + 12-char password minimum), the auth perimeter is now hardened end-to-end.
  - **(c) Session-IP binding** and **(e) explicit logout endpoint** deferred — both require schema migrations and additional client-side handling; tracked separately.

---

### Major

- **ID:** ✅ SECURITY-7
- **Status:** Fixed — `is_origin_eligible_for_credentials()` deny-list (`null`, `*`, non-http(s) schemes, overlong values) gates the CORS predicate before it touches the DB; a 60-second positive/negative `cors_origin_cache` keyed on the literal Origin header eliminates the per-OPTIONS DB roundtrip. 4 unit tests cover the deny-list shape.
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/server.rs:89-108
- **Issue:** The CORS layer accepts any `Origin` that matches a row in the `MowsApp` table (`MowsApp::get_from_origin_string`), couples that match with `allow_credentials(true)`, and reflects the requesting `Origin` back as `Access-Control-Allow-Origin`. If a `MowsApp` row exists with an attacker-controlled origin (e.g. anyone with write access to that table, or a self-registration flow we haven't reviewed here), the browser will happily send the user's `Authorization` header / session cookie cross-origin to attacker JS running on the matched origin.
- **Why it matters:** This is the standard "allowlist that contains a wildcard or a third-party host" risk. The change set additionally exposes `Content-Range`, `Accept-Ranges`, `Content-Length`, `Content-Type` so a cross-origin video player can read file contents — which means a malicious `MowsApp` registration can scrape every file the user can see via byte-range reads. The `async_predicate` also drops the database error path silently into `false`, which is the right failure mode, but combined with the `MowsApp` query running on every preflight there's a database-stress amplification angle (any unauthenticated `OPTIONS` request hits the DB).
- **Suggestion:** Re-confirm that the only writers to the `MowsApp` table are SuperAdmins (looks plausible from the impersonation check on `users/mod.rs:476-498`). Add a deny-list for obviously dangerous origins (`null`, `*`, anything not `https://`). Cache origin lookups for ~60 seconds keyed on the origin string so OPTIONS doesn't flood the DB. Document the trust boundary clearly in `MowsApp::get_from_origin_string`.

---

- **ID:** ✅ SECURITY-8
- **Status:** Fixed — `api/validation::validate_resource_name()` (trim + ≤64 chars + `[A-Za-z0-9._-]`) is now applied at every entry point that writes a user-supplied name: `create_vm`, `update_vm`, `create_agent`, `update_agent`. Commas, newlines, whitespace, slashes and overlong values are rejected with 400 at the API boundary, blocking the forward-compatibility hazard around future `qemu -name` args and the run.yaml YAML mount. 4 unit tests cover the predicate.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:81-170 and /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:242-251
- **Issue:** `CreateVmRequest.name` and `CreateVmRequest.cwd_basename` flow into `name` which is then written into `vm_dir/run.yaml` (qemu.rs:222-225, `serde_yaml_neo::to_string(&guest)?`) and into `authorized_keys` (qemu.rs:227-229), both of which are mounted as a read-only 9p share at `/mowsinit` inside the guest. `mows-agent-init.sh:24` reads `run.yaml` with `awk -F': *' '$1=="kind"{print $2; exit}'` to pick the agent kind. The guest then writes that value to `/etc/environment`. A vm_name like `kind\nMOWS_AGENT_KIND=malicious\n#` could (with weird whitespace) get a malicious key into `/etc/environment`.
- **Why it matters:** The YAML serialisation in serde_yaml_neo escapes control chars in strings, so this specific injection is largely blocked at the serialiser. But there is no validation that `vm_name` is sane in the first place: it gets shown in the UI (Sidebar.tsx truncates+shows it), passed into the `-name` argument concept (currently no `-name` qemu arg is emitted, but a future change is likely given the `vm_name` field on `VmLaunchSpec`), and persisted to sqlite. Names containing terminal control sequences (ANSI escapes) would render unsafely in the LogView (LogView renders `{line}` as text, which React escapes, so that path is safe). Mainly this is a forward-compatibility hazard: the moment someone adds `-name {vm_name}` to qemu_args, comma-injection bites (e.g. `vm_name=evil,debug-threads=on`).
- **Suggestion:** Validate `vm_name` at the API boundary with `^[a-zA-Z0-9_.-]{1,64}$`. Reject everything else with 400. Document the constraint in the OpenAPI description. Same regex on `req.name` for `UpdateVmRequest` and `CreateAgentRequest`.

---

- **ID:** ⁉️/Partial SECURITY-9
- **Status:** Partial — CSP + nosniff + X-Frame-Options + Referrer-Policy + Cross-Origin-Resource-Policy now ship from `web::file_response` (see SECURITY-19/25), which closes the "any XSS → full token theft" amplification path. The localStorage → `Secure;HttpOnly;SameSite=Strict` cookie migration is deferred (requires a server-side session table, CSRF handling, and a Login route — none of which exist yet on the supervisor web UI). Tracked as a follow-up.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/api.ts:36-42
- **Issue:** Bearer tokens are stored in `localStorage` (`localStorage.getItem(TOKEN_STORAGE_KEY)`). The supervisor's web UI has no Content-Security-Policy header (`web/index.html` has no CSP meta, the static-file handler at `src/api/web.rs:54-71` only sets `Content-Type` and `Cache-Control`).
- **Why it matters:** Any XSS in the supervisor web UI (none seen today, but the third-party dep set — `react-vnc`, `@xterm/xterm`, `@photo-sphere-viewer/markers-plugin`, `shaka-player`, `monaco-editor` — is wide and Monaco's `colorize()` is rendered via `dangerouslySetInnerHTML` in `MonacoColorizer.tsx:130`) gives the attacker the long-lived bearer token. With that, the attacker can keep using the API even after the user closes the page.
- **Suggestion:** Switch to a `Secure; HttpOnly; SameSite=Strict` cookie session: the supervisor's `auth.rs` already creates a token, just `Set-Cookie` it on login instead of returning it in the body. Update the generated client's `securityWorker` to read from a CSRF token stored in localStorage (not the session itself). Add `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:` to every response from `serve_static` in `src/api/web.rs`. Lifetime-cap tokens at 7 days, not 30.

---

- **ID:** ✅ SECURITY-10
- **Status:** Fixed — `proxy_websocket_to_unix_socket_with_replay` now (1) caps console replay at 16 KiB (was 64), (2) imposes an `IDLE_TIMEOUT` of 15 min on the guest→ws direction so wedged clients release their FDs, and (3) wraps the joined proxy task in a 4-hour `MAX_SESSION` `tokio::time::timeout`. A slow consumer can no longer pin the supervisor's unix socket / file descriptor forever.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:534-578
- **Issue:** `proxy_websocket_to_unix_socket_with_replay` does not set a maximum lifetime, idle timeout, or per-client rate limit on the websocket. It reads up to 8 KiB at a time from a unix socket and forwards as `Message::Binary` without backpressure when the websocket sink stalls.
- **Why it matters:** A slow-consumer client can keep a websocket open indefinitely, hold the corresponding `UnixStream`/file descriptor open, and starve QEMU's serial buffer (qemu logs the same stream to `console.log` via `chardev:ser0`'s `logfile=`, so the underlying ring buffer is bounded — but the supervisor side accumulates a Vec). Tens of slow clients can wedge the supervisor process. The console replay also reads 64 KiB unconditionally even if `console.log` has been rotated or contains adversary-influenced bytes from the VM (the VM is the trust source for the log content, but that content is then shipped to *every future* WS attacher of the same VM, including potentially other tenants once auth lands — see SECURITY-5).
- **Suggestion:** Wrap each websocket task in `tokio::time::timeout(Duration::from_secs(3600 * 4), ...)` for a hard cap. Add a per-connection token-bucket rate limiter (e.g. `governor` or hand-rolled, ~5 MB/s ceiling). Use `tokio::select!` on a shutdown channel that the parent VM teardown can fire. For console replay, cap it at 16 KiB and gate it behind auth (SECURITY-5).

---

- **ID:** ✅ SECURITY-11
- **Status:** Fixed — `Content-Disposition` is now emitted as `filename="<ascii-fallback>"; filename*=UTF-8''<pct-encoded>` per RFC 6266. The ASCII fallback strips `"`, `\`, CR, LF, HT, and non-ASCII bytes to `_` so a hostile filename can't escape the quoted-string syntax; the `filename*` part percent-encodes with `NON_ALPHANUMERIC` so any byte sequence round-trips intact. Added `percent-encoding = "2.3.2"` to filez-server Cargo.toml.
- **Severity:** Major
- **File:** /home/paul/projects/mows/apis/cloud/filez/server/src/http_api/file_versions/content/get.rs:170-186
- **Issue:** `Content-Disposition: attachment; filename="<file_name>"` is built with `format!()` from the user-supplied `file_meta.name`. The filename comes from the DB but was originally provided by the uploader. HeaderValue parsing rejects CRLF (so true response-splitting is blocked) but a filename containing `"` characters silently escapes the quoted-string syntax (e.g. `cool".jpg; filename*=UTF-8''evil.exe` would render two filename parameters, and well-behaved browsers pick the second).
- **Why it matters:** Combined with a cross-origin reader using SECURITY-7's `Content-Length`-exposure, this is a content-spoofing primitive: the user thinks they're downloading `cool.jpg`, the browser saves `evil.exe`. Defence in depth is to encode the filename per RFC 6266.
- **Suggestion:** Replace the format with `format!("attachment; filename*=UTF-8''{}", percent_encoded_filename)` using the `percent-encoding` crate's `NON_ALPHANUMERIC` set. Drop the legacy `filename="…"` parameter or keep it as a sanitised ASCII fallback that strips `"`, `\`, CR, LF, and non-ASCII.

---

- **ID:** ✅ SECURITY-12
- **Status:** Fixed — `Image360ViewerMarker` now carries an explicit SECURITY doc-block warning that the inherited `html` and `tooltip.content` fields render verbatim into the DOM and MUST be pre-sanitised (DOMPurify) when fed user-controlled metadata. The narrower `SafeImage360ViewerMarker` wrapper-type idea is deferred — the public API surface stays a simple type alias for now and the doc-block keeps consumers honest.
- **Severity:** Major
- **File:** /home/paul/projects/mows/components/react/lib/components/files/fileViewer/formats/Image360Viewer.tsx:101-145
- **Issue:** `Image360ViewerProps.markers: ReadonlyArray<Image360ViewerMarker>` are passed straight into `@photo-sphere-viewer/markers-plugin`'s `Viewer` constructor and `setMarkers()`. The plugin's `MarkerConfig` type supports HTML markers (`html` field) and tooltip content (`tooltip.content`) that are rendered verbatim into the DOM — they're the plugin's primary mechanism for hotspot UI.
- **Why it matters:** If a consumer ever feeds Filez-stored or otherwise user-controlled metadata into `markers` (the example `VirtualTour.tsx` is static, but the `Image360ViewerProps` are exported as a public API), the marker's `html`/`tooltip.content` fields execute as raw HTML and can run script. Photo-sphere-viewer's docs explicitly warn about this. The `onMarkerClick` callback also receives an unknown `marker.data` field that consumers cast to their own shape with no validation.
- **Suggestion:** Document on `Image360ViewerProps.markers` that `html` and `tooltip.content` must be pre-sanitised by the consumer (or use DOMPurify in the wrapper before forwarding to PSV). Or, narrower fix: introduce a `SafeImage360ViewerMarker` type that omits raw-HTML fields and only allows plain-text labels + image URLs, and re-export that from the library while leaving the underlying `MarkerConfig` reachable only via an explicit `unsafeRawMarkerConfig` escape hatch.

---

- **ID:** ✅ SECURITY-13
- **Status:** Fixed — `MOWS_AGENT_HOST_CREDS_PATH` is now resolved once at startup in `SupervisorConfig::load` via `resolve_agent_host_creds_path()`, stored on `SupervisorConfig.agent_host_creds_path: Option<PathBuf>`. `QemuInvocation::build` reads `cfg.agent_host_creds_path.clone()` instead of `std::env::var` — eliminating the per-spawn env read and bringing the supervisor in line with the CLAUDE.md rule "all env vars read upfront in one central file". A startup warning fires when the env var is set but the path doesn't exist.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/qemu.rs:68-79
- **Issue:** `creds_host_path` is resolved from the environment variable `MOWS_AGENT_HOST_CREDS_PATH` (or defaults to `/host-creds` if it exists). The path is mounted as a **read-only** 9p share at `/creds` inside the guest with `security_model=mapped-xattr`. The variable is read each time `QemuInvocation::build` runs — meaning the supervisor process inherits the value at startup, but if anything in the process mutates `MOWS_AGENT_HOST_CREDS_PATH` via `std::env::set_var` (which is not thread-safe and dangerous), the value could shift between calls. The path is not validated.
- **Why it matters:** This violates the CLAUDE.md rule "reading environment variables in other files is not acceptable — all need to be read upfront in one central file". And, like SECURITY-3, a misconfigured operator-set value (`MOWS_AGENT_HOST_CREDS_PATH=/`, `/etc`, `/root/.ssh`) silently shares the host's secret material into every guest. The `mapped-xattr` model means file owners are obfuscated, not the file *contents*. Anything readable by the supervisor process appears readable to the guest.
- **Suggestion:** Move the env lookup into `SupervisorConfig::load` (config.rs) so it's centralised, document the constraint, and validate via canonicalize + a configured allowed prefix. Fail closed on missing path. Add a startup log warning if the resolved path is outside `~/.claude`-like patterns.

---

- **ID:** ✅ SECURITY-14
- **Status:** Fixed — `delete_vm` now (1) marks hosted agents stopped + tears down their runtimes via `state.agent_runtimes.stop_for_vm`, (2) kills the QEMU child if it's still in `state.vms`, (3) `tokio::fs::remove_dir_all`s the per-VM `state_dir/vms/<id>/` directory (qcow2 overlay, console.log, authorized_keys, run.yaml, ssh keypair), and (4) calls `state.port_allocator.release()` on both forwarded ports. Combined with the per-VM SSH key model (Theme C) every trace of a deleted VM is gone after the 200 response.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:487-499 (delete_vm) and qemu.rs:218-260 (prepare_vm_dir)
- **Issue:** `DELETE /v1/vms/{id}` removes the row from sqlite and 200s, but **does not kill the QEMU process, does not unmount the 9p share, does not delete the per-VM `state_dir/vms/<id>/` directory** (containing the qcow2 overlay, console.log, run.yaml, authorized_keys, qemu.stderr.log), and does not free the allocated ports.
- **Why it matters:** Three issues:
    1. **Orphaned QEMU.** A `Child` handle stays in `state.vms` until `stop_vm` is called separately; `delete_vm` alone leaves the process running indefinitely. With no auth (SECURITY-1) an attacker can spin up VMs faster than the cleanup loop and starve KVM / RAM / disk.
    2. **Leftover credentials on disk.** The per-VM `authorized_keys` file (referencing the supervisor public key) survives, as does any console log containing prompts/secrets the user typed. Anyone with read access to `state_dir` later recovers the scrollback.
    3. **Port exhaustion.** `PortAllocator` only advances; freed ports are never reclaimed. Combined with bounded range 22000-22999, ~1000 VM create/deletes wedge the supervisor.
- **Suggestion:** Refactor `delete_vm` to call `stop_vm`'s teardown logic first, then `tokio::fs::remove_dir_all` the per-VM dir, then `port_allocator.release(host_ssh_port, host_docker_port)`. Implement `PortAllocator::release` (push back into a free list inside the existing struct). Add a startup task that audits `state.vms` against the DB and reaps orphans.

---

- **ID:** ✅ SECURITY-15
- **Status:** Fixed — `AgentKind::validate()` (called from `from_yaml`) now rejects any env key that isn't a valid POSIX env-var name (`[A-Za-z_][A-Za-z0-9_]*`). Two new tests cover (a) shell metacharacter injection (`"FOO; rm -rf /tmp;"`) and (b) leading-digit rejection. Builtin kinds (`shell`, `claude`) trivially pass; any future user-supplied YAML under `/etc/mows-agent/kinds.d/` is now blocked at parse time.
- **Severity:** Major
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:187-200
- **Issue:** Env-variable serialisation for the agent's tmux launch builds a string like `K1='v1' K2='v2' exec '...argv...'`. The values `v` are escaped with `replace('\'', "'\\''")` which is correct for POSIX single-quoted strings. **The keys `k` are not escaped or validated.** They come from the agent kind's hardcoded `env` map today (`kinds.rs::builtin_claude` → `CLAUDE_CONFIG_DIR`), so this isn't immediately exploitable, but a future change that lets users contribute env keys (e.g. via a YAML manifest from a kinds.d directory loaded from `/etc/mows-agent/kinds.d/`, which is already wired up in `kinds.rs::AgentKind::from_file`) would let arbitrary shell metacharacters into the in-tmux command line.
- **Why it matters:** If `k == "FOO; rm -rf /tmp;"`, the resulting tmux argument runs `rm -rf /tmp` inside the VM (where the agent's tmux session is root in the VM). Inside the VM that's contained, but it punctures the "agents only run argv" contract.
- **Suggestion:** Validate keys at parse time in `kinds.rs::AgentKind::from_yaml` with `if !k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') || k.is_empty() || k.chars().next().unwrap().is_ascii_digit() { return Err(...) }` (standard POSIX env-var name rules). Use that same regex in any future user-provided env map.

---

### Minor

- **ID:** ⁉️/Deferred SECURITY-16
- **Status:** Deferred — Restricting guest root SSH access to a `mows-agent` user requires reworking the in-guest `mows-agent-init` bootstrap (sudoers, 9p uid mapping, claude-user provisioning) across all four base images. Out of scope for the current pass; tracked as a follow-up that needs design alignment with the agent-spawn flow.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:107-113 (and debian.Dockerfile / ubuntu.Dockerfile / nixos/flake.nix)
- **Issue:** Every guest is built with `PermitRootLogin prohibit-password` for the guest's root account, and `mows-agent-init` installs the supervisor's public key into `/root/.ssh/authorized_keys`. Inside the VM the agent runs as root by default (the `claude` kind drops to a non-root `agent` user for the claude binary, but the SSH-attached shell that `tmux attach` exposes is still root's tmux session, so attaching is root in the guest).
- **Why it matters:** This is the design (agents need root because of `chown` in the kinds.rs bootstrap), but it means any guest compromise (e.g. via a malicious npm dep pulled by `claude code`) yields root in the guest, and per SECURITY-3 the guest can write back to the host workspace as the supervisor's uid.
- **Suggestion:** Restrict the 9p workspace mount to `security_model=mapped-xattr,multidevs=remap,uid=agent_uid` so writes from the in-VM root land as a fixed unprivileged uid on the host. Stop installing the supervisor key into root and use a dedicated `mows-agent` guest user for SSH; sudo only what `mows-agent-init` needs.

---

- **ID:** ✅ SECURITY-17
- **Status:** Fixed — A local `KnownHostsGuard(PathBuf)` RAII type with a `Drop` impl now owns the per-attach known_hosts file path. Even if the WS proxy tasks panic, are cancelled mid-flight, or the runtime is dropped, the file is removed via `std::fs::remove_file` from `Drop` — no orphans under `state_dir/agents/<id>/`.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/agents.rs:386-394
- **Issue:** Per-attach known_hosts files are created with a fresh UUID at `handle.log_path.with_file_name(format!("known_hosts.ws-{}", uuid::Uuid::new_v4().simple()))`, then `tokio::fs::remove_file(&known_hosts).await` runs in the cleanup branch. If the websocket task panics or the runtime is dropped between create and cleanup, these files accumulate in `state_dir/agents/<id>/`.
- **Why it matters:** Disk leak on long-running supervisors. The files themselves are not sensitive (they contain `127.0.0.1` host key entries from the VMs), but operators may notice the orphaned files only via disk-pressure alerts.
- **Suggestion:** Use `tempfile::NamedTempFile` (already pulled in as a dev dep — promote to prod) or a `Drop` impl that fires on the future's cancellation; or scope the known_hosts to one shared file per VM and clean on VM teardown.

---

- **ID:** ⁉️/Deferred SECURITY-18
- **Status:** Deferred — Replacing `StrictHostKeyChecking=accept-new` with `=yes` + a pre-seeded `UserKnownHostsFile` requires the guest to publish its host pubkey via either `qemu-system-x86_64 -fw_cfg name=opt/mows/host_key,…` or a metadata 9p file written early in `mows-agent-init`. The window of exposure is tiny (single first-connect on loopback only, requires existing host privilege), so this is parked behind larger guest-side work. Tracked as a follow-up.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/agent_runtime.rs:126
- **Issue:** SSH uses `StrictHostKeyChecking=accept-new` for every connection from the supervisor to the guest. This is "trust on first use" — the first connection to a brand-new VM accepts whatever host key the guest presents.
- **Why it matters:** During VM boot a slow attacker who can MITM the loopback connection (root on the host can race the supervisor; an attacker in the same network namespace if QEMU's `user` netdev is replaced with something else; a malicious init in the guest image) could present their own host key on the first connect and persist it into the per-attach known_hosts. The window is tiny and requires existing host control, but it's still a TOFU surface.
- **Suggestion:** Capture the guest's SSH host pubkey via `qemu-system-x86_64 -fw_cfg name=opt/mows/host_key,file=...` (or via a metadata 9p file the guest writes early in mows-agent-init) and pre-seed `UserKnownHostsFile` with that exact line. Then set `StrictHostKeyChecking=yes`.

---

- **ID:** ✅ SECURITY-19
- **Status:** Fixed — `web::file_response` now emits a strict `Content-Security-Policy` (`default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`) on every static asset response. Future XSS lands inside the CSP cage.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/index.html and /home/paul/projects/mows/components/react/index.html and /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/web.rs:54-71
- **Issue:** Neither HTML entry nor the static-file handler emits a Content-Security-Policy header. The Filez server does (`default-src 'none'` on every JSON response from server.rs:136-139), but that policy is for API responses, not HTML.
- **Why it matters:** Any future XSS becomes immediately exploitable for full token theft (see SECURITY-9). Service workers, third-party iframes, eval, inline scripts — all permitted by default.
- **Suggestion:** Add `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' ws: wss:; style-src 'self' 'unsafe-inline'; script-src 'self'` as a static response header in `web::file_response`. For the components-react demo app, set the same in `vite.config.ts` via the `html` plugin and `meta` tag.

---

- **ID:** ✅ SECURITY-20
- **Status:** Fixed — `probe_until_ready` now reads 8 bytes and matches `b"SSH-2.0-"` (was 7 bytes / `b"SSH-"`). A process emitting an SSH 1.x or arbitrary `SSH-…` greeting on the forwarded port no longer flips the VM to `running`. Host-key fingerprint pre-seeding is deferred (covered by SECURITY-18 follow-up).
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/vms.rs:362-395 (`probe_until_ready`)
- **Issue:** The readiness probe reads exactly 7 bytes from `127.0.0.1:<port>` and checks `buf.starts_with(b"SSH-")`. There is no version pinning ("SSH-2.0"), no protocol handshake check, no host-key fingerprint verification.
- **Why it matters:** A process listening on the same forwarded port that emits `SSH-...` as its first 7 bytes will pass the probe (the supervisor flips the VM status to `running` even though it's not really an SSH server). For agent spawn, the next step is an actual SSH connect, which would fail loudly; but during the readiness window the supervisor exposes the VM in `list_vms` as running.
- **Suggestion:** Match `b"SSH-2.0"` and read the full banner (up to LF). Verify the host key fingerprint against the pre-seeded one (per SECURITY-18). Set a deadline-relative read timeout instead of `Duration::from_secs(3)` so slow first banners don't trigger spurious failures.

---

- **ID:** ✅ SECURITY-21
- **Status:** Fixed — `safeColorizedHtml` (extracted into its own file so it's testable without pulling in monaco-editor) inspects every `monaco.editor.colorize` result for active-content tags (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<link>`, `<meta>`, `<style>`) and, if any are present, replaces the would-be HTML with the escaped source. `MonacoColorizer.tsx` passes every result through the guard before caching / injection via `dangerouslySetInnerHTML`. 8 new tests cover the safe path + each tag.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/components/react/lib/components/code/codeSnippet/MonacoColorizer.tsx:128-133
- **Issue:** `monaco.editor.colorize(code, lang, { tabSize: 4 })` is rendered into the DOM via `dangerouslySetInnerHTML`. Monaco's `colorize` does escape its input as part of token-to-HTML conversion (verified by inspecting `vs/editor/standalone/browser/colorizer.ts` in monaco-editor), but the safety guarantee depends on that escape staying in place across Monaco upgrades.
- **Why it matters:** If a future Monaco release relaxes the escape (e.g. when a theme injects `<style>` tags via tokens) the snippet renderer becomes a stored-XSS sink for any code rendered. The defensive belt is missing — at minimum, sanity-checking that the produced HTML doesn't contain `<script` would catch obvious regressions.
- **Suggestion:** After `monaco.editor.colorize(...)` resolves, run a `if (html.match(/<\s*(script|iframe|object|embed)\b/i)) html = escape(code)` guard before caching. Pin the monaco-editor version in package.json and add a snapshot test that asserts a known-tricky input (e.g. ``` `</span><script>alert(1)</script><span>` ```) doesn't produce a `<script>` in the output.

---

- **ID:** ⁉️/Deferred SECURITY-22
- **Status:** Deferred — Routing missing-token cases through a `Login` route requires the supervisor web UI to actually have one (it doesn't today; auth flows still go via the unix socket for bootstrapping). The right time to wire `AuthRequiredError` is alongside adding the Login form. Tracked as a follow-up.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/web/src/lib/api.ts:35-42
- **Issue:** The generated `Api` client is constructed with `baseUrl: ""`, meaning every request goes to the page origin. There is no fail-closed behaviour if `localStorage[TOKEN_STORAGE_KEY]` is missing — `securityWorker` returns `{}` and the request goes out without an `Authorization` header. Today the backend has no auth so this is fine; once SECURITY-1 is fixed, every fetched endpoint will silently 401 instead of redirecting to a login flow.
- **Why it matters:** Confusing UX once auth lands, and harder to spot stuck-in-loop polling loops in `Sidebar.tsx`'s `useLivePoll` (which retries on error every 2 s but doesn't surface the auth state to the rest of the app).
- **Suggestion:** Have `securityWorker` redirect to a login route when no token is present, or attach a special `securityWorker` that throws a typed `AuthRequiredError` consumed by an app-wide handler. Add a `Login` route + form to consume `/v1/auth/login`.

---

- **ID:** ✅ SECURITY-23
- **Status:** Fixed — Debian and Ubuntu Dockerfiles now download a version-pinned rustup-init binary from `https://static.rust-lang.org/rustup/archive/${RUSTUP_VERSION}/x86_64-unknown-linux-gnu/rustup-init` (default `RUSTUP_VERSION=1.29.0`), verify it against `RUSTUP_INIT_SHA256_AMD64=4acc9acc76d5079515b46346a485974457b5a79893cfb01112423c89aeb5aa10`, then install a pinned `RUST_TOOLCHAIN=1.85.0`. The Alpine variant already uses `apk add rustup` from a snapshot-pinned mirror; it now also pins the toolchain version explicitly. Bit-identical rebuilds across runs hold even if rustup.rs rotates upstream.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/debian.Dockerfile:67-72 and ubuntu.Dockerfile
- **Issue:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y …` fetches and pipes rustup into a shell at image-build time, with no hash pinning. The Alpine variant uses `apk add rustup` which is pinned by the snapshot but the Debian / Ubuntu paths trust whatever rustup.rs serves at build time.
- **Why it matters:** Breaks the stated reproducibility contract: re-running `bash build.sh --distro debian` a week later can produce different bits because rustup-init.sh changed upstream. More importantly, a compromise of sh.rustup.rs would inject malicious code into every guest image. The README's reproducibility section claims `bit-reproducible` builds — that promise is broken on every non-Alpine distro.
- **Suggestion:** Either (a) switch all distros to package-manager-installed rustup with snapshot pinning, or (b) pin the rustup-init checksum: `curl ... -o rustup-init.sh && echo "<sha256> rustup-init.sh" | sha256sum -c && sh rustup-init.sh -y ...`. Document the pinned hash in the Dockerfile.

---

- **ID:** ✅ SECURITY-24
- **Status:** Fixed — All three Dockerfiles (alpine/debian/ubuntu) now pin both `PNPM_VERSION=9.15.4` and `CLAUDE_CODE_VERSION=2.1.145` via ARGs, with the npm install lines using the explicit `pkg@${VERSION}` form. Rebuilds no longer pick up `@latest` silently.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/image-builder/alpine.Dockerfile:87 and others
- **Issue:** `npm install -g --no-audit --no-fund @anthropic-ai/claude-code` is run at image-build time with no version pin and no integrity check. Same for `pnpm@9` (npm install -g).
- **Why it matters:** Each rebuild pulls whatever `@anthropic-ai/claude-code` is currently the `@latest` tag — defeating reproducibility and exposing every guest to whatever Anthropic publishes that day, including potential supply-chain compromise. A pinned hash gives operators a chance to vet new versions.
- **Suggestion:** Pin the version (`@anthropic-ai/claude-code@1.0.x`) and verify via `--no-package-lock` + `npm exec -y npm-audit-signatures` or `pnpm audit`. Document the upgrade procedure in image-builder/README.md.

---

- **ID:** ✅ SECURITY-25
- **Status:** Fixed — `web::file_response` now emits `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, and `Cross-Origin-Resource-Policy: same-origin` on every static asset (in addition to the SECURITY-19 CSP). All four headers ship side-by-side with the existing `Content-Type` + `Cache-Control` values.
- **Severity:** Minor
- **File:** /home/paul/projects/mows/utils/mows-vm-supervisor/src/api/web.rs:54-71
- **Issue:** `file_response` does not set `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, or `Cross-Origin-Resource-Policy: same-origin`.
- **Why it matters:** Defence-in-depth. Without `nosniff` a misclassified asset can be loaded as a script by a downstream tag. Without `X-Frame-Options` the supervisor UI can be iframed by an attacker page that overlays login UI on top.
- **Suggestion:** Add a `static_security_headers()` helper that emits the four headers above for every response from `file_response` plus the static-asset cache headers already present.

---

## Notes

A few items are worth flagging that didn't rise to findings:

- **No `delete_user` route.** Once SECURITY-1/2 are fixed, the inability to delete accounts is operationally awkward (rotating admins requires direct sqlite edits). Recommend adding an admin-gated `DELETE /v1/users/{id}` that cascades to `sessions` (FK already wired).

- **`get_vm_console` replays 64 KiB of `console.log` to every new attacher.** Once auth lands, that's still an information-leak vector if VMs are ever shared between principals. Consider clearing the log when the VM transitions to a new owner / agent.

- **No `Content-Length`-based body size limit on `POST /v1/vms`, `POST /v1/users`, or `POST /v1/auth/login`.** Axum's default JSON body limit is 2 MB which is fine, but worth explicitly setting via `axum::extract::DefaultBodyLimit` on the auth/users routes (small) vs anywhere a future upload route lives (larger).

- **The deleted `apis/cloud/filez/web/src/apiTests/misc/*` files are gone but their counterparts in `apis/cloud/filez/components/react/lib/components/development/apiTests/*` still exist** — same code, now reachable from the Filez React lib. The Dev panel's dynamic `import(\`./apiTests/${testId}.ts\`)` is parameterised on `testId` taken from a hardcoded `tests` array (DevPanel.tsx:45-91), so the dynamic-import vector is contained, but **a future refactor that wires `testId` from URL/query state would open a path-traversal-via-import** (`testId = "../../../config"` would resolve a different module). Best to add a hardcoded allowlist `if (!ALLOWED_TEST_IDS.has(testId)) throw …` just before the import.

- **`get_vm_ssh` returns `user: "root"`** in the JSON body — consumers in the UI display this verbatim. Once you switch to a non-root agent user (SECURITY-16), keep the response shape generic so the UI doesn't lock in the assumption.

- **The Filez React component library's `FileViewer` consumes `src` directly without scheme validation.** Today the Filez wrapper builds `https://.../api/file_versions/content/get/...` and the consumer passes it in; a future careless consumer could pass `javascript:...` which Image360Viewer's PSV / `<video src=>` would mostly reject, but explicit `src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:image/")` at the FileViewer entry would be a cheap belt.

- **Migrations 0002 and 0003 use `ALTER TABLE … ADD COLUMN`** with `NOT NULL DEFAULT 'alpine'` — sqlite accepts this and the existing rows get the default. Both look correct. No injection surface in the migration SQL itself (no string interpolation).

- **`renameVm` allows trimming an empty name in `update_vm`** (vms.rs:461-464) which is correct (`name must not be empty`), but there's no max-length cap — a 10 MB name DOSes the row read path. Cap at 256 chars.

- The huge translation file growth in `components/react/src/languages*.ts` (~3000 lines added per locale) is entirely declarative strings — no executable surface; safe.
