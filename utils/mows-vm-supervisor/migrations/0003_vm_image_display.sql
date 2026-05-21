-- Persist the image base + display mode chosen at VM creation time.
-- `image` is one of {'alpine','ubuntu','debian','nixos'}; only `alpine` is
-- currently available end-to-end (the image-builder still has to grow the
-- others). `display_mode` is `'headless'` (SSH-only) or `'desktop'` (VNC
-- display surface).
ALTER TABLE vms ADD COLUMN image        TEXT NOT NULL DEFAULT 'alpine';
ALTER TABLE vms ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'headless';
