-- Track per-VM resource allocation so the detail panel can show CPU + RAM
-- without re-deriving from the running QEMU process. `NULL` columns on
-- pre-existing rows are interpreted as "we didn't record this; render
-- the active server defaults instead".
ALTER TABLE vms ADD COLUMN cpus INTEGER;
ALTER TABLE vms ADD COLUMN memory_mb INTEGER;
