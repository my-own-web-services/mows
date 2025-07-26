-- Your SQL goes here

CREATE TABLE "users"(
	"id" UUID NOT NULL PRIMARY KEY,
	"external_user_id" TEXT,
	"pre_identifier_email" TEXT,
	"display_name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"deleted" BOOL NOT NULL,
	"profile_picture" UUID,
	"created_by" UUID,
	"super_admin" BOOL NOT NULL
);
CREATE TABLE "files"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"mime_type" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"metadata" JSONB NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
);



CREATE TABLE "file_groups"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"description" TEXT,
	"group_type" SMALLINT NOT NULL,
	"dynamic_group_rule" JSONB,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
);


CREATE TABLE "storage_locations"(
	"id" UUID NOT NULL PRIMARY KEY,
	"name" TEXT NOT NULL,
	"provider_config" JSONB NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL
);

CREATE TABLE "storage_quotas"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"subject_type" SMALLINT NOT NULL,
	"subject_id" UUID NOT NULL,
	"storage_location_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"quota_bytes" NUMERIC NOT NULL,
	FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id")
);

CREATE TABLE "user_user_group_members"(
	"user_id" UUID NOT NULL,
	"user_group_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	PRIMARY KEY("user_id", "user_group_id")
);

CREATE TABLE "file_file_group_members"(
	"file_id" UUID NOT NULL,
	"file_group_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	PRIMARY KEY("file_id", "file_group_id"),
	FOREIGN KEY ("file_id") REFERENCES "files"("id"),
	FOREIGN KEY ("file_group_id") REFERENCES "file_groups"("id")
);



CREATE TABLE "apps"(
	"id" UUID NOT NULL PRIMARY KEY,
	"name" TEXT NOT NULL,
	"origins" TEXT[],
	"trusted" BOOL NOT NULL,
	"description" TEXT,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL
);

CREATE TABLE "file_group_file_sort_orders"(
	"id" UUID NOT NULL PRIMARY KEY,
	"file_group_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"created_by_user_id" UUID NOT NULL,
	FOREIGN KEY ("file_group_id") REFERENCES "file_groups"("id"),
	FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
);

CREATE TABLE "file_group_file_sort_order_items"(
	"sort_order_id" UUID NOT NULL,
	"file_id" UUID NOT NULL,
	"position" INTEGER NOT NULL,
	PRIMARY KEY("sort_order_id", "file_id", "position"),
	FOREIGN KEY ("sort_order_id") REFERENCES "file_group_file_sort_orders"("id"),
	FOREIGN KEY ("file_id") REFERENCES "files"("id")
);

CREATE TABLE "tags"(
	"id" UUID NOT NULL PRIMARY KEY,
	"key" TEXT NOT NULL,
	"value" TEXT NOT NULL
);

CREATE TABLE "file_versions"(
	"id" UUID NOT NULL UNIQUE,
	"file_id" UUID NOT NULL,
	"version" INTEGER NOT NULL,
	"app_id" UUID NOT NULL,
	"app_path" TEXT NOT NULL,
	"metadata" JSONB NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"size" NUMERIC NOT NULL,
	"storage_location_id" UUID NOT NULL,
	"storage_quota_id" UUID NOT NULL,
	"content_valid" BOOL NOT NULL,
	"content_expected_sha256_digest" TEXT,
	PRIMARY KEY("file_id", "version", "app_id", "app_path"),
	FOREIGN KEY ("file_id") REFERENCES "files"("id"),
	FOREIGN KEY ("app_id") REFERENCES "apps"("id"),
	FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id"),
	FOREIGN KEY ("storage_quota_id") REFERENCES "storage_quotas"("id")
);


CREATE TABLE "user_groups"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"description" TEXT,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
);

CREATE TABLE "jobs"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"app_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"status" JSONB NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"start_time" TIMESTAMP,
	"end_time" TIMESTAMP,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id"),
	FOREIGN KEY ("app_id") REFERENCES "apps"("id")
);

CREATE TABLE "user_relations"(
	"user_id" UUID NOT NULL,
	"friend_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"status" SMALLINT NOT NULL,
	PRIMARY KEY("user_id", "friend_id")
);

CREATE TABLE "tag_members"(
	"resource_id" UUID NOT NULL,
	"resource_type" SMALLINT NOT NULL,
	"tag_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"created_by_user_id" UUID NOT NULL,
	FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id"),
	FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
);

CREATE TABLE "access_policies"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"subject_type" SMALLINT NOT NULL,
	"subject_id" UUID NOT NULL,
	"context_app_id" UUID,
	"resource_type" SMALLINT NOT NULL,
	"resource_id" UUID,
	"actions" SMALLINT[] NOT NULL,
	"effect" SMALLINT NOT NULL
);


CREATE TABLE "key_access"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"key_hash" TEXT NOT NULL,
	"description" TEXT,
	"user_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"expiration_time" TIMESTAMP
);

CREATE TABLE "events"(
	"id" UUID NOT NULL PRIMARY KEY,
	"created_time" TIMESTAMP NOT NULL,
	"event_type" SMALLINT NOT NULL,
	"user_id" UUID,
	"resource_ids" UUID[],
	"resource_type" SMALLINT,
	"app_id" UUID,
	"result" JSONB
	FOREIGN KEY ("user_id") REFERENCES "users"("id"),
	FOREIGN KEY ("app_id") REFERENCES "apps"("id")
);
