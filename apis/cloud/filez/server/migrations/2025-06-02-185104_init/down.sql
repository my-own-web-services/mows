-- This file should undo anything in `up.sql`
ALTER TABLE "files" DROP COLUMN "created_time";
ALTER TABLE "files" DROP COLUMN "modified_time";
ALTER TABLE "files" ADD COLUMN "created_at" TIMESTAMP NOT NULL;

DROP TABLE IF EXISTS "users";
