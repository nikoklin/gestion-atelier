CREATE TABLE `emailLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`packageId` int,
	`emailType` enum('reminder','expiration','session_summary') NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`success` boolean NOT NULL DEFAULT true,
	CONSTRAINT `emailLogs_id` PRIMARY KEY(`id`)
);
