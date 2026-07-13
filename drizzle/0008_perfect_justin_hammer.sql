ALTER TABLE `packages` MODIFY COLUMN `packageType` enum('15h_8w','30h_8w','30h_4w','180h_6m') NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` MODIFY COLUMN `startDate` datetime NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` MODIFY COLUMN `endDate` datetime NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` DROP COLUMN `status`;