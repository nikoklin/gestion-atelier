ALTER TABLE `attendances` ADD CONSTRAINT `attendances_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_packageId_packages_id_fk` FOREIGN KEY (`packageId`) REFERENCES `packages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_residentId_residents_id_fk` FOREIGN KEY (`residentId`) REFERENCES `residents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attendances_residentId_idx` ON `attendances` (`residentId`);--> statement-breakpoint
CREATE INDEX `attendances_packageId_idx` ON `attendances` (`packageId`);--> statement-breakpoint
CREATE INDEX `packages_residentId_idx` ON `packages` (`residentId`);--> statement-breakpoint
CREATE INDEX `packages_isActive_idx` ON `packages` (`isActive`);