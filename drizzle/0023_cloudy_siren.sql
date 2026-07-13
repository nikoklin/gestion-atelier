CREATE TABLE `actionTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`actionType` enum('fix_checkout','create_pending_package') NOT NULL,
	`residentId` int NOT NULL,
	`attendanceId` int,
	`packageTypeId` int,
	`usedAt` datetime,
	`expiresAt` datetime NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actionTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `actionTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `actionTokens` ADD CONSTRAINT `actionTokens_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `actionTokens` ADD CONSTRAINT `actionTokens_attendanceId_attendances_id_fk` FOREIGN KEY (`attendanceId`) REFERENCES `attendances`(`id`) ON DELETE cascade ON UPDATE no action;