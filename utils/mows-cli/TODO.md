#### 52. cargo-workspace-docker.toml Regeneration in Build

**File:** `build.sh:23-29`

Build script modifies source tree, violates build hermeticity.

**Recommendation:** Verify instead of regenerate.

**This is fixed by addressing the bigger issue of generating this whole stuff inside the container, also fixing the issue with cargo-chef**

# security scanning

- container updates etc

# firewall

# automatic container updates

# regular backups, especially of databases

# multiple docker volumes locations

# ensure drives are not spammed with logs that noone reads

# add mpm compose edit or add

- to add things like the traefik/routing config to the templates
- to add postgres to the template

# frontend config.json should be served with the index html and be set as a global variable to prevent cascading loads

# create new projects from templates

# mpm compose watch

# dev container vms mit config und auto dependency setup, also good for testing and everything else, devpod
