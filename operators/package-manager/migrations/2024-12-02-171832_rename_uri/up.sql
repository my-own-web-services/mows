-- Your SQL goes here
DROP TABLE IF EXISTS `repository`;
CREATE TABLE `repositories`(
	`id` INTEGER NOT NULL PRIMARY KEY,
	`uri` TEXT NOT NULL
);

