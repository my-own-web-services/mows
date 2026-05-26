-- Identity Providers
--
-- v1 ships with exactly one row: Zitadel. The table exists so a v2 IdP
-- (Keycloak, Authentik, …) can land without rewriting users / apps. See
-- AUTHENTICATION.md §2 "Pluggable IdP" and DATA_MODEL.md §2.1-§2.2.
--
-- This migration is intentionally minimal — it only adds the table and
-- seeds the Zitadel row. A follow-up migration will add idp_id columns
-- to users and apps once the FilezUser / MowsApp Rust structs are
-- updated to carry the new field.

CREATE TABLE idp_providers (
    id            UUID PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    discovery_url TEXT NOT NULL,
    created_time  TIMESTAMP NOT NULL
);

-- The deterministic Zitadel UUID. The leading '7a17ade1' (zitade1) is a
-- mnemonic so anyone reading raw rows can spot the sentinel. Other rows
-- — added when a second IdP is wired up — should use random UUIDs.
INSERT INTO idp_providers (id, name, discovery_url, created_time) VALUES (
    '7a17ade1-0000-0000-0000-000000000001',
    'zitadel',
    '',  -- populated by the install scripts at deploy time
    now()
);
