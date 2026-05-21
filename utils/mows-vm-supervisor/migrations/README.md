# mows-vm-supervisor migrations

Applied automatically at startup via `sqlx::migrate`. The runtime crashes
with a typed `DatabaseError::MigrationFailed { migration, source }` if any
fail to apply (no silent-skip path) — see SLOP-9.

| File                            | Summary                                                                                       | Reversibility |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------- |
| `0001_init.sql`                 | Create the `users`, `sessions`, `vms`, `agents` tables + supporting indexes.                  | Schema reset only — no down migration provided. |
| `0002_vm_resources.sql`         | Add nullable `cpus`, `memory_mb` columns to `vms` so the API can record per-VM allocation.    | NULL-safe; pre-existing rows fall back to `vm_defaults` at render time. |
| `0003_vm_image_display.sql`     | Add `image` (`alpine`/`ubuntu`/`debian`/`nixos`, default `alpine`) and `display_mode` (`headless`/`desktop`) NOT NULL columns to `vms`. | Pre-existing rows are defaulted to `alpine`+`headless` per DEVOPS-42. |

## Expected scale

The supervisor manages a single host's VMs — typical deployments stay under
~1,000 `vms` rows and ~5,000 `agents` rows lifetime. We therefore intentionally
**do not** create secondary indexes on `cpus`, `memory_mb`, `image`, or
`display_mode`: the SQLite table scans involved are sub-millisecond at this
scale (DEVOPS-43). Revisit if a deployment ever crosses ~50k VM rows — at that
point the `vms.status` and `vms.image` columns become natural index targets.

## Rollback

`sqlx::migrate` does not auto-run `.down.sql` siblings, but for emergency
ops we ship them where the column is safely droppable. SQLite ≥ 3.35 supports
`ALTER TABLE … DROP COLUMN`; older builds need a table-rebuild migration. Each
`.down.sql` documents the limitation in its header comment (DEVOPS-44).

## When you write a new migration

1. Add a new `00NN_<short_name>.sql` here. `sqlx::migrate` runs them in
   numeric-prefix order.
2. Keep `ALTER TABLE … ADD COLUMN` nullable or supply a `DEFAULT` so
   existing rows don't trip a CHECK constraint. SQLite cannot drop
   columns below 3.35 — pick the column type carefully on the first
   pass.
3. Add a one-line row to the table above describing the schema delta
   and the rollback story (if any). The e2e suite picks the change up
   automatically as long as the `Harness` boot path still succeeds.
4. If a code change consumes the new column, update the matching DTO in
   `src/api/{vms,agents,users,auth}.rs` and re-run `bash scripts/codegen.sh`
   to refresh `openapi.json` + the TypeScript client.
