-- Three review-driven hardening fixes:
--
--   1. Drop the column DEFAULT on users.idp_id / apps.idp_id (SEC-4 +
--      SLOP-3). All Rust insert paths supply ZITADEL_IDP_ID explicitly
--      via mows_auth_core::ZITADEL_IDP_ID; the default was a safety
--      net during migration 002 that has now outlived its purpose. With
--      the default in place, a future code path that adds a new IdP
--      and forgets to populate idp_id silently routes the row to
--      Zitadel — a cross-IdP account-takeover vector. Without the
--      default, the same omission is a Postgres NOT NULL violation
--      at INSERT time — loud, immediate, recoverable.
--
--   2. Allow idp_providers.discovery_url to be NULL with semantics
--      "not yet configured by install scripts; fail closed in the
--      introspector" (SLOP-1 + SEC-6). The seeded empty string was a
--      contract violation — a Postgres column documented as the OIDC
--      discovery endpoint should not be valid as the empty string. A
--      NULL value is honest about the "not configured" state and lets
--      the introspector return IntrospectionError::Unreachable (→ 503,
--      retriable once install completes) rather than attempting to
--      GET against the empty URL.
--
--   3. Normalize the Zitadel row's created_time to a deterministic
--      sentinel (1970-01-01) (SLOP-2). A reproducible DB build is a
--      CLAUDE.md requirement; now() at migration time made two clusters
--      that ran the same migrations produce byte-different rows for
--      a sentinel record.

ALTER TABLE users  ALTER COLUMN idp_id DROP DEFAULT;
ALTER TABLE apps   ALTER COLUMN idp_id DROP DEFAULT;

ALTER TABLE idp_providers ALTER COLUMN discovery_url DROP NOT NULL;
UPDATE idp_providers
    SET discovery_url = NULL
    WHERE name = 'zitadel' AND discovery_url = '';

UPDATE idp_providers
    SET created_time = '1970-01-01 00:00:00'
    WHERE id = '7a17ade1-0000-0000-0000-000000000001';
