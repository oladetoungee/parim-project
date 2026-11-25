ALTER TABLE `assignment` MODIFY COLUMN `created_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_log` MODIFY COLUMN `created_at` datetime(3) NOT NULL;--> statement-breakpoint
ALTER TABLE `shift_request` MODIFY COLUMN `created_at` datetime(3) NOT NULL;