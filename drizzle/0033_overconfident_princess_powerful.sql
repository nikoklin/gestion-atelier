ALTER TABLE `atelierSettings` ADD `reminderSendHour` int DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE `atelierSettings` ADD `missedCheckoutCutoffHour` int DEFAULT 22 NOT NULL;