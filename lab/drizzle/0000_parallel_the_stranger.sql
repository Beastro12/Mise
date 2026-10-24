CREATE TABLE `bridges` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`text` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bridges_lesson_idx` ON `bridges` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `builds` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`title` text NOT NULL,
	`prediction` text DEFAULT '' NOT NULL,
	`results` text DEFAULT '' NOT NULL,
	`comparison` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`concept_id` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `builds_lesson_idx` ON `builds` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `completion_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`evidence` text NOT NULL,
	`completed_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `completion_entity_idx` ON `completion_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`concept` text NOT NULL,
	`established_name` text DEFAULT '' NOT NULL,
	`my_version` text DEFAULT '' NOT NULL,
	`where_it_breaks` text DEFAULT '' NOT NULL,
	`build_link` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'met' NOT NULL,
	`lesson_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`recall_box` integer DEFAULT 0 NOT NULL,
	`next_recall_at` text,
	`last_recalled_at` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `concepts_next_recall_idx` ON `concepts` (`next_recall_at`);--> statement-breakpoint
CREATE TABLE `explain_backs` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`concept_id` text,
	`prompt` text NOT NULL,
	`answer` text NOT NULL,
	`grade` text NOT NULL,
	`feedback` text NOT NULL,
	`missing_pieces` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `explain_backs_lesson_idx` ON `explain_backs` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`order_index` integer NOT NULL,
	`title` text NOT NULL,
	`objectives` text NOT NULL,
	`pre_work` text NOT NULL,
	`build_exercise` text,
	`bridge_prompt` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lessons_module_idx` ON `lessons` (`module_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_session_idx` ON `messages` (`session_id`);--> statement-breakpoint
CREATE TABLE `modules` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`order_index` integer NOT NULL,
	`size` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modules_code_unique` ON `modules` (`code`);--> statement-breakpoint
CREATE TABLE `parking_lot` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recalls` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`grade` text NOT NULL,
	`module_check_run_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recalls_concept_idx` ON `recalls` (`concept_id`);--> statement-breakpoint
CREATE INDEX `recalls_run_idx` ON `recalls` (`module_check_run_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`summary` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sessions_lesson_idx` ON `sessions` (`lesson_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`module_code` text DEFAULT '—' NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`read_status` text DEFAULT 'unread' NOT NULL
);
