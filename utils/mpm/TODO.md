#### 52. cargo-workspace-docker.toml Regeneration in Build

**File:** `build.sh:23-29`

Build script modifies source tree, violates build hermeticity.

**Recommendation:** Verify instead of regenerate.

**This is fixed by addressing the bigger issue of generating this whole stuff inside the container, also fixing the issue with cargo-chef**
