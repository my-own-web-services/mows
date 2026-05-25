-- Small controlled fixture.
-- Users: Paul (owner), Alice, Bob
-- Apps:  upload-ui (frontend), webgrabber (backend, untrusted)
-- One Submissions file_group owned by Paul
-- One storage_location quota for Paul

BEGIN;

INSERT INTO mows_auth.users (id, external_user_id, display_name, user_type) VALUES
    (md5('user-paul')::uuid,  'paul',  'Paul',  1),
    (md5('user-alice')::uuid, 'alice', 'Alice', 1),
    (md5('user-bob')::uuid,   'bob',   'Bob',   1);

INSERT INTO mows_auth.apps (id, name, trusted, app_type) VALUES
    (md5('app-upload-ui')::uuid, 'upload-ui', FALSE, 0),
    (md5('app-webgrabber')::uuid,'webgrabber',FALSE, 1);

INSERT INTO filez.file_groups (id, owner_id, name) VALUES
    (md5('fg-submissions')::uuid, md5('user-paul')::uuid, 'Submissions');

INSERT INTO filez.storage_quotas (id, owner_id, storage_location_id, quota_bytes) VALUES
    (md5('sq-paul-default')::uuid,
     md5('user-paul')::uuid,
     md5('storage-default')::uuid,
     100000000);   -- 100 MB allowance for Paul on the default location

COMMIT;
