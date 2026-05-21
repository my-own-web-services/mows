-- Rollback for 0002_vm_resources.sql (DEVOPS-44).
--
-- SQLite ≥ 3.35 supports `ALTER TABLE … DROP COLUMN`. On older builds the
-- emergency rollback is a table rebuild (CREATE TABLE … AS SELECT id, name,
-- … FROM vms; DROP TABLE vms; ALTER TABLE … RENAME TO vms;).

ALTER TABLE vms DROP COLUMN cpus;
ALTER TABLE vms DROP COLUMN memory_mb;
