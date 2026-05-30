//! Dev-only endpoints. Gated by `config.enable_dev = true`.
//!
//! The chat MVP doesn't ship real authentication yet (auth
//! middleware trusts an X-Realtime-User-Id header — see
//! `authentication/middleware.rs`). Until Round 7 swaps in
//! Zitadel, these endpoints exist so the SQL test + demo flow can
//! create users + seed sample policies without external
//! infrastructure.

pub mod seed;
