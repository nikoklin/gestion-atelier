CREATE TABLE `undoActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`beforeState` mediumtext NOT NULL,
	`afterState` mediumtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `undoActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `undoActions` ADD CONSTRAINT `undoActions_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `undoActions_residentId_idx` ON `undoActions` (`residentId`);