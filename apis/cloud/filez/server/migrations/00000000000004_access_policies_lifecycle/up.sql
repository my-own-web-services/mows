-- Phase 2 lifecycle columns on access_policies.
--
-- DATA_MODEL.md §2.4 + USAGE_LIMITS.md "Cross-API bundles":
--
--   * `expires_at` — soft auto-expiry. The engine's PolicyStore impls
--     filter on `(expires_at IS NULL OR expires_at > now())`. Audit
--     log keeps the row.
--   * `revoked` — soft delete for audit. Same filter shape:
--     `NOT revoked`. The Picker writes this column to revoke a
--     consent without deleting the row.
--   * `policy_bundle_id` — opaque grouping for the cross-API bundle
--     UX (USAGE_LIMITS.md). Set when N policies are created in one
--     Picker consent; NULL for standalone policies. The engine
--     deliberately does NOT read this column on the hot path; only
--     the share-management UI and bulk revoke queries consult it.
--     Partial index keeps it cheap.

ALTER TABLE access_policies
    ADD COLUMN expires_at TIMESTAMP NULL,
    ADD COLUMN revoked BOOL NOT NULL DEFAULT FALSE,
    ADD COLUMN policy_bundle_id UUID NULL;

-- Hot-path partial indexes per DATA_MODEL.md §2.4: the existing
-- ap_lookup_idx and ap_subject_idx in the init migration use
-- `WHERE NOT revoked` on the assumption that this column exists.
-- That assumption is satisfied as of this migration; future
-- migrations can drop and rebuild the existing indexes if needed.

-- Bundle grouping: cheap partial index for the share-management UI.
CREATE INDEX ap_policy_bundle_id_idx
    ON access_policies (policy_bundle_id)
    WHERE policy_bundle_id IS NOT NULL;
