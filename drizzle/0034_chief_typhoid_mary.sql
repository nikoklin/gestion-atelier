ALTER TABLE `emailLogs` MODIFY COLUMN `emailType` enum('reminder','expiration','session_summary','guide','shelf_release','integrity_alert','payment_queued') NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `autoStart` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `packages` ADD `shelfEmailSent` boolean DEFAULT false NOT NULL;