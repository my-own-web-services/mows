-- Your SQL goes here
CREATE TABLE "files"(
	"file_id" BIGSERIAL NOT NULL PRIMARY KEY,
	"owner_id" BIGINT NOT NULL,
	"mime_type" TEXT NOT NULL,
	"file_name" TEXT NOT NULL,
	"created_at" TIMESTAMP NOT NULL
);

