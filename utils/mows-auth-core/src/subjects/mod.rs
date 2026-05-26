//! Subject types: `MowsUser` (renamed from `FilezUser` during extraction)
//! and `MowsApp`. App identity & authentication resolution land here.
//!
//! TODO Phase 1: move `apis/cloud/filez/server/src/models/users/mod.rs`
//! and `apis/cloud/filez/server/src/models/apps/mod.rs` into this module,
//! renaming the types. Filez keeps a type alias `FilezUser = MowsUser`
//! during the transition.

use uuid::Uuid;

/// The deterministic UUID for the v1 Zitadel row in `idp_providers`.
///
/// Seeded by the `00000000000001_idp_providers` migration in every
/// service that consumes mows-auth-core. The leading `7a17ade1`
/// (zitade1) is a mnemonic so the sentinel is recognizable in raw
/// rows; future IdPs (Keycloak, Authentik) use random UUIDs.
///
/// Referenced from `users.idp_id` / `apps.idp_id` defaults. See
/// AUTHENTICATION.md §2 "Pluggable IdP".
pub const ZITADEL_IDP_ID: Uuid = Uuid::from_u128(0x7a17ade1_0000_0000_0000_000000000001);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zitadel_idp_id_matches_migration_seed() {
        assert_eq!(
            ZITADEL_IDP_ID.to_string(),
            "7a17ade1-0000-0000-0000-000000000001",
            "must match the seed UUID in filez's 00000000000001_idp_providers migration"
        );
    }
}
