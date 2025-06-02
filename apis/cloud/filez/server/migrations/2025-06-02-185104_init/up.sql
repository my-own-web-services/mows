-- Your SQL goes here
ALTER TABLE "files" DROP COLUMN "created_at";
ALTER TABLE "files" ADD COLUMN "created_time" TIMESTAMP NOT NULL;
ALTER TABLE "files" ADD COLUMN "modified_time" TIMESTAMP NOT NULL;

CREATE TABLE "users"(
	"user_id" UUID NOT NULL PRIMARY KEY,
	"external_user_id" TEXT,
	"display_name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL
);

