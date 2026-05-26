-- Attach existing users and apps to the v1 Zitadel IdP row that the
-- previous migration seeded. The DEFAULT backfills existing rows and
-- keeps Rust call sites that don't yet supply idp_id working — every
-- new user/app silently routes to the Zitadel row.
--
-- The default stays in place for v1. Once a second IdP is wired up
-- (Keycloak / Authentik) a follow-up migration will DROP the default
-- so new rows must supply idp_id explicitly.
--
-- See AUTHENTICATION.md §2 "Pluggable IdP" and DATA_MODEL.md §2.1-§2.2.

ALTER TABLE users
    ADD COLUMN idp_id UUID NOT NULL
        DEFAULT '7a17ade1-0000-0000-0000-000000000001'
        REFERENCES idp_providers(id);

ALTER TABLE apps
    ADD COLUMN idp_id UUID NOT NULL
        DEFAULT '7a17ade1-0000-0000-0000-000000000001'
        REFERENCES idp_providers(id);

-- Partial unique: per-IdP uniqueness on the external sub. NULL allowed
-- (a user can exist before introspection populates external_user_id —
-- pre_identifier_email is the lookup key in that window).
CREATE UNIQUE INDEX users_idp_external_id_idx
    ON users (idp_id, external_user_id)
    WHERE external_user_id IS NOT NULL;
