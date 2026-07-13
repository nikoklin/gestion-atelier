ALTER TABLE `atelierSettings` ADD `reminderDaysBeforeExpiry` int DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `atelierSettings` ADD `guideEmailEnabled` boolean DEFAULT true NOT NULL;