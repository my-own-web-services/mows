//! Subject types: `MowsUser` (renamed from `FilezUser` during extraction)
//! and `MowsApp`. App identity & authentication resolution land here.
//!
//! TODO(ROADMAP Phase 1): move
//! `apis/cloud/filez/server/src/models/users/mod.rs` and
//! `apis/cloud/filez/server/src/models/apps/mod.rs` into this module,
//! renaming the types. Filez keeps a type alias `FilezUser = MowsUser`
//! during the transition.
//!
//! The `ZITADEL_IDP_ID` sentinel that used to live here moved to
//! [`crate::idp`] — its semantic home — once `idp.rs` was promoted to
//! a directory module.
