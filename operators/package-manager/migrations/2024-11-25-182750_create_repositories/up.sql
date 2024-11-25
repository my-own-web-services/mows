-- Your SQL goes here
DROP TABLE IF EXISTS `repository`;
CREATE TABLE `repositories`(
	`id` INTEGER NOT NULL PRIMARY KEY,
	`url` TEXT NOT NULL
);

