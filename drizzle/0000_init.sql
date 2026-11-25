CREATE TABLE `assignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shift_id` int NOT NULL,
	`staff_id` int NOT NULL,
	`override_reason` varchar(500),
	`created_by` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `assignment_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignment_shift_staff_uq` UNIQUE(`shift_id`,`staff_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`shift_id` int,
	`actor` varchar(64) NOT NULL,
	`action` varchar(60) NOT NULL,
	`payload` json NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`venue` varchar(120) NOT NULL,
	`starts_on` date NOT NULL,
	`ends_on` date NOT NULL,
	`timezone` varchar(64) NOT NULL,
	CONSTRAINT `event_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `licence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staff_id` int NOT NULL,
	`kind` varchar(20) NOT NULL,
	`number` varchar(40) NOT NULL,
	`expires_on` date NOT NULL,
	CONSTRAINT `licence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `location` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `location_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`requires_sia` boolean NOT NULL DEFAULT false,
	CONSTRAINT `role_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `shift` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_id` int NOT NULL,
	`location_id` int NOT NULL,
	`role_id` int NOT NULL,
	`starts_at` datetime NOT NULL,
	`ends_at` datetime NOT NULL,
	`slots` int NOT NULL,
	`notes` text,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `shift_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shift_request` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shift_id` int NOT NULL,
	`staff_id` int NOT NULL,
	`status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
	`created_at` datetime NOT NULL,
	CONSTRAINT `shift_request_id` PRIMARY KEY(`id`),
	CONSTRAINT `shift_request_shift_staff_uq` UNIQUE(`shift_id`,`staff_id`)
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`role_id` int NOT NULL,
	`email` varchar(160) NOT NULL,
	`weekly_hour_limit` int NOT NULL DEFAULT 48,
	CONSTRAINT `staff_id` PRIMARY KEY(`id`),
	CONSTRAINT `staff_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `assignment` ADD CONSTRAINT `assignment_shift_id_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assignment` ADD CONSTRAINT `assignment_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `licence` ADD CONSTRAINT `licence_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift` ADD CONSTRAINT `shift_event_id_event_id_fk` FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift` ADD CONSTRAINT `shift_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift` ADD CONSTRAINT `shift_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_request` ADD CONSTRAINT `shift_request_shift_id_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `shift`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shift_request` ADD CONSTRAINT `shift_request_staff_id_staff_id_fk` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `staff` ADD CONSTRAINT `staff_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assignment_staff_idx` ON `assignment` (`staff_id`);--> statement-breakpoint
CREATE INDEX `audit_event_id_idx` ON `audit_log` (`event_id`,`id`);--> statement-breakpoint
CREATE INDEX `audit_shift_id_idx` ON `audit_log` (`shift_id`,`id`);--> statement-breakpoint
CREATE INDEX `licence_staff_idx` ON `licence` (`staff_id`);--> statement-breakpoint
CREATE INDEX `location_event_idx` ON `location` (`event_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `shift_event_starts_idx` ON `shift` (`event_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `shift_request_staff_idx` ON `shift_request` (`staff_id`);--> statement-breakpoint
CREATE INDEX `staff_role_idx` ON `staff` (`role_id`);--> statement-breakpoint
CREATE INDEX `staff_name_idx` ON `staff` (`name`);