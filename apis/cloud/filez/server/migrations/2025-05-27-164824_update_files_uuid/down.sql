-- This file should undo anything in `up.sql`
ALTER TABLE "files" DROP COLUMN "file_id";
ALTER TABLE "files" DROP COLUMN "owner_id";
ALTER TABLE "files" ADD COLUMN "file_id" INT8 NOT NULL;
ALTER TABLE "files" ADD COLUMN "owner_id" INT8 NOT NULL;

