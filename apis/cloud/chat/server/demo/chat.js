// Static demo client for chat-server. Pure ES modules, no build
// step. The page is served from the chat-server itself
// (config.enable_dev = true) at `/demo/`. Exercises the full
// engine path: list_visible, check, REST CRUD, WebSocket subscribe.
//
// Phase 7 honest scope: this is a demo client, not a production
// frontend. Phase 7 manager-UI integration (with @mows/react-components,
// proper auth, shared UI primitives) is a separate later effort.

const KNOWN_USERS = []; // populated by Seed
let currentChannel = null;
let ws = null;

const $ = (id) => document.getElementById(id);

function log(msg) {
    const el = $("log");
    el.textContent = `${new Date().toISOString().slice(11, 19)} ${msg}\n${el.textContent}`.slice(0, 4000);
}

function headersFor(method) {
    const h = { "Content-Type": "application/json" };
    const acting = $("acting-user").value;
    if (acting) h["X-Chat-User-Id"] = acting;
    return h;
}

async function api(path, method = "GET", body = undefined) {
    const opts = { method, headers: headersFor(method) };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const json = await res.json().catch(() => ({ status: { Error: "non-json" }, message: res.statusText }));
    if (!res.ok) {
        const err = json.status?.Error || "error";
        log(`!! ${method} ${path} → HTTP ${res.status} (${err}) — ${json.message}`);
        throw new Error(json.message);
    }
    return json;
}

async function seed() {
    const res = await api("/api/dev/seed", "POST");
    KNOWN_USERS.length = 0;
    KNOWN_USERS.push(
        { id: res.data.alice_id, name: "Alice" },
        { id: res.data.bob_id, name: "Bob" }
    );
    populateUserDropdowns();
    $("seed-status").textContent = `Seeded: ${KNOWN_USERS.map(u => u.name).join(", ")}`;
    log(`seeded users: alice=${res.data.alice_id} bob=${res.data.bob_id}`);
}

function populateUserDropdowns() {
    for (const sel of ["acting-user", "share-user"]) {
        const el = $(sel);
        const current = el.value;
        el.innerHTML = "";
        if (sel === "acting-user") {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "(anonymous)";
            el.appendChild(opt);
        }
        for (const u of KNOWN_USERS) {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = `${u.name}  (${u.id.slice(0, 8)}…)`;
            el.appendChild(opt);
        }
        el.value = current;
    }
}

async function loadChannels() {
    const list = $("channel-list");
    list.innerHTML = "<small>loading…</small>";
    try {
        const res = await api("/api/channels/list", "POST");
        list.innerHTML = "";
        if (res.data.channels.length === 0) {
            list.innerHTML = "<small>no channels visible to this user</small>";
            return;
        }
        for (const ch of res.data.channels) {
            const row = document.createElement("div");
            row.className = "channel-row";
            const name = document.createElement("strong");
            name.textContent = ch.name;
            const topic = document.createElement("small");
            topic.textContent = ch.topic ? `— ${ch.topic}` : "";
            const open = document.createElement("button");
            open.textContent = "Open";
            open.onclick = () => openChannel(ch);
            row.append(name, topic, open);
            list.appendChild(row);
        }
    } catch (e) {
        list.innerHTML = `<small>failed: ${e.message}</small>`;
    }
}

async function createChannel() {
    const name = $("new-channel-name").value.trim();
    if (!name) {
        log("!! channel name required");
        return;
    }
    const topic = $("new-channel-topic").value.trim() || null;
    try {
        const res = await api("/api/channels/create", "POST", { name, topic });
        log(`created channel ${res.data.channel.id}`);
        $("new-channel-name").value = "";
        $("new-channel-topic").value = "";
        await loadChannels();
    } catch {}
}

async function openChannel(ch) {
    currentChannel = ch;
    $("channel-pane").hidden = false;
    $("active-channel-name").textContent = ch.name;
    $("active-channel-id").textContent = ch.id;
    await loadMessages();
    subscribeWs(ch.id);
}

async function loadMessages() {
    const el = $("messages");
    el.innerHTML = "<small>loading…</small>";
    try {
        const res = await api(`/api/channels/${currentChannel.id}/messages`);
        renderMessages(res.data.messages.reverse());
    } catch (e) {
        el.innerHTML = `<small>failed: ${e.message}</small>`;
    }
}

function renderMessages(messages) {
    const el = $("messages");
    el.innerHTML = "";
    for (const m of messages) {
        appendMessageRow(m);
    }
    el.scrollTop = el.scrollHeight;
}

function appendMessageRow(m) {
    const el = $("messages");
    const row = document.createElement("div");
    row.className = "message";
    const author = KNOWN_USERS.find((u) => u.id === m.author_id);
    const label = author ? author.name : m.author_id.slice(0, 8);
    row.textContent = `[${m.sent_at.slice(11, 19)}] ${label}: ${m.body}`;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
}

async function sendMessage() {
    const body = $("new-message").value;
    if (!body) return;
    try {
        await api(`/api/channels/${currentChannel.id}/messages/send`, "POST", { body });
        $("new-message").value = "";
        // WS pushes the message back — no manual reload needed.
    } catch {}
}

async function share() {
    const subjectId = $("share-user").value;
    if (!subjectId) {
        log("!! pick a user to share with");
        return;
    }
    const sel = $("share-actions");
    const actions = Array.from(sel.selectedOptions).map((o) => o.value);
    if (actions.length === 0) {
        log("!! pick at least one action");
        return;
    }
    try {
        await api("/api/access_policies/create", "POST", {
            name: `share-${Date.now()}`,
            subject_type: "User",
            subject_id: subjectId,
            resource_type: "Channel",
            resource_id: currentChannel.id,
            actions,
            effect: "Allow",
        });
        log(`shared channel with ${subjectId.slice(0, 8)} → ${actions.join(",")}`);
    } catch {}
}

function subscribeWs(channelId) {
    if (ws) {
        ws.close();
        ws = null;
    }
    const actingUser = $("acting-user").value;
    if (!actingUser) {
        log("WS not opened (anonymous — no user selected)");
        return;
    }
    // Browsers can't set arbitrary headers on WebSocket upgrades.
    // chat-server's auth middleware also honours `?user=<uuid>`
    // when config.enable_dev = true (see authentication/middleware.rs).
    // Production wiring uses Zitadel OIDC; this fallback is dev-only.
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${location.host}/api/channels/${channelId}/live?user=${actingUser}`;
    ws = new WebSocket(url);
    ws.onopen = () => {
        $("live-dot").classList.add("on");
        log(`WS open (channel ${channelId.slice(0, 8)}…)`);
    };
    ws.onmessage = (ev) => {
        try {
            const event = JSON.parse(ev.data);
            if (event.kind === "ready") {
                log(`WS ready (subscription installed)`);
            } else if (event.kind === "message") {
                appendMessageRow(event.message);
            } else if (event.kind === "lagged") {
                log(`!! ${event.dropped} events dropped — reloading history`);
                loadMessages();
            }
        } catch {}
    };
    ws.onclose = () => {
        $("live-dot").classList.remove("on");
        log("WS closed");
    };
    ws.onerror = () => log("WS error (likely 403 — see auth middleware note in chat.js)");
}

function leaveChannel() {
    if (ws) {
        ws.close();
        ws = null;
    }
    currentChannel = null;
    $("channel-pane").hidden = true;
}

$("seed-btn").onclick = seed;
$("create-channel").onclick = createChannel;
$("reload-channels").onclick = loadChannels;
$("send-message").onclick = sendMessage;
$("share-btn").onclick = share;
$("leave-channel").onclick = leaveChannel;
$("acting-user").addEventListener("change", () => {
    log(`acting as ${$("acting-user").value || "anonymous"}`);
    loadChannels();
    if (currentChannel) subscribeWs(currentChannel.id);
});
$("new-message").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

log("ready — click 'Seed Alice + Bob' to begin");
