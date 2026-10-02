CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "participants_nonnegative_count" CHECK("participants"."count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_name_key` ON `participants` (`name_key`);--> statement-breakpoint
CREATE TABLE `score_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`delta` integer NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "score_operations_valid_delta" CHECK("score_operations"."delta" IN (-1, 1))
);
