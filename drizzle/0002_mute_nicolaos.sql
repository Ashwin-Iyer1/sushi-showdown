CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_token_hash` text NOT NULL,
	`host_participant_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
DROP INDEX `idx_participants_name_key`;--> statement-breakpoint
ALTER TABLE `participants` ADD `room_id` text REFERENCES rooms(id);--> statement-breakpoint
ALTER TABLE `participants` ADD `participant_token_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_participants_room_name` ON `participants` (`room_id`,`name_key`);