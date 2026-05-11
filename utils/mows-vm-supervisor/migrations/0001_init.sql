CREATE TABLE users (
    id           TEXT PRIMARY KEY,
    username     TEXT NOT NULL UNIQUE,
    argon2_hash  TEXT NOT NULL,
    role         TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at   TEXT NOT NULL
);

CREATE TABLE sessions (
    token        TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at   TEXT NOT NULL
);

-- VMs are pure infrastructure: a QEMU instance with networking, disk and the
-- two unix-socket display/console streams. They have no notion of which
-- workload is running inside them.
CREATE TABLE vms (
    id                 TEXT PRIMARY KEY,
    name               TEXT NOT NULL,
    status             TEXT NOT NULL CHECK (status IN ('starting','running','stopping','stopped','failed')),
    cwd                TEXT,
    host_ssh_port      INTEGER,
    host_docker_port   INTEGER,
    qemu_pid           INTEGER,
    started_at         TEXT NOT NULL,
    exited_at          TEXT,
    exit_code          INTEGER,
    owner_user_id      TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX vms_status_idx ON vms(status);
CREATE INDEX vms_owner_idx ON vms(owner_user_id);

-- Agents are workloads that run *inside* a VM (SSH-spawned processes).
-- Many agents can live in one VM; deleting a VM cascades through.
CREATE TABLE agents (
    id            TEXT PRIMARY KEY,
    vm_id         TEXT NOT NULL REFERENCES vms(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('starting','running','stopping','stopped','failed')),
    started_at    TEXT NOT NULL,
    exited_at     TEXT,
    exit_code     INTEGER,
    owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX agents_vm_idx ON agents(vm_id);
CREATE INDEX agents_status_idx ON agents(status);

-- Persistent log of an agent's stdout/stderr (or, future, system messages).
-- The pty stream is also broadcast live; this table is for replay/scrollback.
CREATE TABLE agent_logs (
    agent_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    ts        TEXT NOT NULL,
    stream    TEXT NOT NULL CHECK (stream IN ('stdout','stderr','supervisor')),
    line      TEXT NOT NULL
);

CREATE INDEX agent_logs_agent_ts_idx ON agent_logs(agent_id, ts);

CREATE TABLE chat_messages (
    id        TEXT PRIMARY KEY,
    agent_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
    role      TEXT NOT NULL CHECK (role IN ('user','agent','system')),
    content   TEXT NOT NULL,
    ts        TEXT NOT NULL
);

CREATE INDEX chat_messages_agent_ts_idx ON chat_messages(agent_id, ts);

CREATE TABLE wg_peers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
    pubkey       TEXT NOT NULL UNIQUE,
    allowed_ips  TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
