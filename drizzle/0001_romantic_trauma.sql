CREATE TABLE `emote_events` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_emotes_created_at` ON `emote_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_emotes_participant_time` ON `emote_events` (`participant_id`,`created_at`);