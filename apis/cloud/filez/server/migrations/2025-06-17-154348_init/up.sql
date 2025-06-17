-- Your SQL goes here

CREATE TABLE "users"(
	"id" UUID NOT NULL PRIMARY KEY,
	"external_user_id" TEXT,
	"display_name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"deleted" BOOL NOT NULL
);


CREATE TABLE "files"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"mime_type" TEXT NOT NULL,
	"file_name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
);

CREATE TABLE "file_groups"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"description" TEXT,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
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


CREATE TABLE "file_file_group_members"(
	"file_id" UUID NOT NULL,
	"file_group_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	PRIMARY KEY("file_id", "file_group_id"),
	FOREIGN KEY ("file_id") REFERENCES "files"("id"),
	FOREIGN KEY ("file_group_id") REFERENCES "file_groups"("id")
);

CREATE TABLE "tags"(
	"id" UUID NOT NULL PRIMARY KEY,
	"key" TEXT NOT NULL,
	"value" TEXT NOT NULL
);


CREATE TABLE "file_tag_members"(
	"file_id" UUID NOT NULL,
	"tag_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"created_by_user_id" UUID NOT NULL,
	PRIMARY KEY("file_id", "tag_id"),
	FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
);

CREATE TABLE "access_policies"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"subject_type" TEXT NOT NULL,
	"subject_id" UUID NOT NULL,
	"context_app_id" UUID,
	"resource_type" TEXT NOT NULL,
	"resource_id" UUID NOT NULL,
	"action" TEXT NOT NULL,
	"effect" TEXT NOT NULL
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

CREATE TABLE "user_user_group_members"(
	"user_id" UUID NOT NULL,
	"user_group_id" UUID NOT NULL,
	"created_time" TIMESTAMP NOT NULL,
	PRIMARY KEY("user_id", "user_group_id")
);



CREATE TABLE "apps"(
	"id" UUID NOT NULL PRIMARY KEY,
	"owner_id" UUID NOT NULL,
	"name" TEXT NOT NULL,
	"trusted" BOOL NOT NULL,
	"origins" TEXT[],
	"created_time" TIMESTAMP NOT NULL,
	"modified_time" TIMESTAMP NOT NULL,
	"description" TEXT,
	FOREIGN KEY ("owner_id") REFERENCES "users"("id")
);

