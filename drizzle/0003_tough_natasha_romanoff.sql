CREATE TABLE `participant_access` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `rooms` ADD `owner_user_id` text;