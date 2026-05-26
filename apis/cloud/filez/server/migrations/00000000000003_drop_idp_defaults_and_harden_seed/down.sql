-- Restore the DEFAULTs and the NOT NULL on discovery_url that
-- migration 003 dropped. Re-seeds the discovery_url back to ''.

ALTER TABLE users
    ALTER COLUMN idp_id SET DEFAULT '7a17ade1-0000-0000-0000-000000000001';
ALTER TABLE apps
    ALTER COLUMN idp_id SET DEFAULT '7a17ade1-0000-0000-0000-000000000001';

UPDATE idp_providers
    SET discovery_url = ''
    WHERE name = 'zitadel' AND discovery_url IS NULL;
ALTER TABLE idp_providers ALTER COLUMN discovery_url SET NOT NULL;
