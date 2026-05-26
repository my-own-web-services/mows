//! Subject types: `MowsUser` (renamed from `FilezUser` during extraction)
//! and `MowsApp`. App identity & authentication resolution land here.
//!
//! TODO Phase 1: move `apis/cloud/filez/server/src/models/users/mod.rs`
//! and `apis/cloud/filez/server/src/models/apps/mod.rs` into this module,
//! renaming the types. Filez keeps a type alias `FilezUser = MowsUser`
//! during the transition.
