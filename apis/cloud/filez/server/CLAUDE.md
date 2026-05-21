# HTTP Methods

- utoipa with axum is used for documentation and client generation

- All methods need to be registered in the src/server.rs file
- All methods are defined in the module file: src/http_api/mod.rs

# OpenAPI client regeneration

Any change to a utoipa-annotated handler in `src/http_api/` must rerun
`bash scripts/codegen.sh` from this folder. The script:

1. Builds the `openapi_dump` binary (offline — no live server needed).
2. Writes a fresh `openapi.json` to this folder (committed; PRs that
   touch the API surface must include the regenerated file).
3. Runs `swagger-typescript-api` inside docker to regenerate
   `codegen/typescript/`, then copies the outputs into
   `apis/cloud/filez/components/typescript-client/`.

CI builds `openapi.json` from source via the same script, so a PR that
changes an endpoint without committing the regenerated `openapi.json`
will fail the codegen-drift check.
