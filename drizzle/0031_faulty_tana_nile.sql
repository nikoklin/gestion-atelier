ALTER TABLE `packages` ADD `wixPaymentId` varchar(100);--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_wixPaymentId_idx` UNIQUE(`wixPaymentId`);