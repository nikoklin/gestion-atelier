CREATE TABLE `kioskEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`residentId` int NOT NULL,
	`action` enum('checkin','checkout') NOT NULL,
	`occurredAt` datetime NOT NULL,
	`attendanceId` int,
	`result` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kioskEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `kioskEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `kioskEvents` ADD CONSTRAINT `kioskEvents_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kioskEvents` ADD CONSTRAINT `kioskEvents_attendanceId_attendances_id_fk` FOREIGN KEY (`attendanceId`) REFERENCES `attendances`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `kioskEvents_residentId_idx` ON `kioskEvents` (`residentId`);