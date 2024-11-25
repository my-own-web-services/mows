-- This file should undo anything in `up.sql`
CREATE TABLE `repository`(
	`id` INTEGER NOT NULL PRIMARY KEY,
	`url` TEXT NOT NULL
);

DROP TABLE IF EXISTS `repositories`;
