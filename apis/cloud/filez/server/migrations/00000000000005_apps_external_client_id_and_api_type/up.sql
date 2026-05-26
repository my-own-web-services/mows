-- AUTHENTICATION.md §3.4 (App-type = Api) + §4.2 (external_client_id
-- as the new primary join key for apps).
--
-- Two changes:
--
--   1. `external_client_id TEXT NULL` — the IdP-issued OIDC
--      client_id. Nullable because the sentinel "no-origin"
--      anonymous app has no Zitadel mapping (per AUTHENTICATION.md §4.2).
--      Partial UNIQUE on `(idp_id, external_client_id)` enforces
--      per-IdP uniqueness when the column is populated; NULLs are
--      distinct so the sentinel + a future second-IdP row can both
--      coexist without external_client_id set.
--
--   2. No schema change for the new `AppType::Api = 2` enum variant
--      — the column is SMALLINT and the new variant adds the integer
--      2 to the legal range. Diesel's DbEnum handles the round-trip
--      via the Rust enum's discriminant.

ALTER TABLE apps
    ADD COLUMN external_client_id TEXT NULL;

CREATE UNIQUE INDEX apps_idp_external_client_id_idx
    ON apps (idp_id, external_client_id)
    WHERE external_client_id IS NOT NULL;
