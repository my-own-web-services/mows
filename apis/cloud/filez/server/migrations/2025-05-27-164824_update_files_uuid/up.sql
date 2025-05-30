-- Your SQL goes here
ALTER TABLE "files" DROP COLUMN "file_id";
ALTER TABLE "files" DROP COLUMN "owner_id";
ALTER TABLE "files" ADD COLUMN "file_id" UUID NOT NULL;
ALTER TABLE "files" ADD COLUMN "owner_id" UUID NOT NULL;

