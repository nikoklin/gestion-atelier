CREATE TABLE `wixPaymentLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`residentId` int NOT NULL,
	`packageTypeId` int NOT NULL,
	`wixPaymentLinkId` varchar(100) NOT NULL,
	`url` varchar(500) NOT NULL,
	`amount` int NOT NULL,
	`expiresAt` datetime NOT NULL,
	`paidAt` datetime,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wixPaymentLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `wixPaymentLinks_wixPaymentLinkId_idx` UNIQUE(`wixPaymentLinkId`)
);
--> statement-breakpoint
ALTER TABLE `wixPaymentLinks` ADD CONSTRAINT `wixPaymentLinks_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `wixPaymentLinks_residentId_idx` ON `wixPaymentLinks` (`residentId`);