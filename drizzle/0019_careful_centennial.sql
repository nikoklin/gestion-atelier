CREATE TABLE `atelierSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`totalShelves` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `atelierSettings_id` PRIMARY KEY(`id`)
);
