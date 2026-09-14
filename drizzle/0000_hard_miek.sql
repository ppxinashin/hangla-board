CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`name` text NOT NULL,
	`last_seen` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_participants_room_seen` ON `participants` (`room_code`,`last_seen`);--> statement-breakpoint
CREATE TABLE `room_images` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_images_object_key_unique` ON `room_images` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_room_images_room` ON `room_images` (`room_code`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_key` text NOT NULL,
	`state_json` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`finalized` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;
