CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`content` text NOT NULL,
	`createdBy` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
