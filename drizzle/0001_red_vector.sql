CREATE TABLE `attendances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`packageId` int NOT NULL,
	`checkInTime` datetime NOT NULL,
	`checkOutTime` datetime,
	`durationMinutes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attendances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`packageType` enum('15h_8w','30h_8w','30h_4w') NOT NULL,
	`totalHours` int NOT NULL,
	`usedHours` int NOT NULL DEFAULT 0,
	`startDate` datetime NOT NULL,
	`endDate` datetime NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`reminderSent` boolean NOT NULL DEFAULT false,
	`expirationEmailSent` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `residents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(100) NOT NULL,
	`lastName` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20),
	`qrCode` varchar(100) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `residents_id` PRIMARY KEY(`id`),
	CONSTRAINT `residents_qrCode_unique` UNIQUE(`qrCode`)
);
