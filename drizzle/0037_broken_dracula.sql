ALTER TABLE `atelierSettings` ADD `autoPaymentLinksEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `atelierSettings` ADD `paymentLinkValidityDays` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `atelierSettings` ADD `paymentLinkPackageTypeIds` text;