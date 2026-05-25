-- Foreign keys, applied AFTER the bulk seed.
-- TECH-12 / DEVOPS-12: each constraint is DEFERRABLE INITIALLY IMMEDIATE
-- so production triggers fire normally but bulk loaders can DEFER them
-- per-transaction with `SET CONSTRAINTS ALL DEFERRED`. The earlier
-- version of this file omitted DEFERRABLE — `SET CONSTRAINTS ALL DEFERRED`
-- was a silent no-op.

BEGIN;

ALTER TABLE user_groups
    ADD CONSTRAINT user_groups_owner_fk
    FOREIGN KEY (owner_id) REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE user_user_group_members
    ADD CONSTRAINT uugm_user_fk
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY IMMEDIATE,
    ADD CONSTRAINT uugm_group_fk
    FOREIGN KEY (user_group_id) REFERENCES user_groups(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE files
    ADD CONSTRAINT files_owner_fk
    FOREIGN KEY (owner_id) REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE file_groups
    ADD CONSTRAINT file_groups_owner_fk
    FOREIGN KEY (owner_id) REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE file_file_group_members
    ADD CONSTRAINT ffgm_file_fk
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY IMMEDIATE,
    ADD CONSTRAINT ffgm_group_fk
    FOREIGN KEY (file_group_id) REFERENCES file_groups(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE access_policies
    ADD CONSTRAINT ap_owner_fk
    FOREIGN KEY (owner_id) REFERENCES users(id) DEFERRABLE INITIALLY IMMEDIATE;

COMMIT;
