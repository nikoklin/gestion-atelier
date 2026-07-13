CREATE TABLE `emailTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateType` enum('reminder','expiration','session_summary') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `emailTemplates_templateType_unique` UNIQUE(`templateType`)
);
