-- Rollback for 0003_vm_image_display.sql (DEVOPS-44).
--
-- See `0002_vm_resources.down.sql` for the SQLite < 3.35 fallback.

ALTER TABLE vms DROP COLUMN image;
ALTER TABLE vms DROP COLUMN display_mode;
