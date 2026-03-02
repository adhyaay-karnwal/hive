CREATE TABLE `change_comments` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`session_id` text,
	`file_path` text NOT NULL,
	`start_line` integer NOT NULL,
	`end_line` integer NOT NULL,
	`side` text,
	`content` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_change_comments_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `dev_profile` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY,
	`session_id` text,
	`project_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_messages_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`),
	CONSTRAINT `fk_messages_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`pkg_manager` text,
	`dev_command` text,
	`install_command` text,
	`config_override` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` text PRIMARY KEY,
	`review_id` text NOT NULL,
	`file_path` text NOT NULL,
	`line_number` integer,
	`side` text,
	`author` text NOT NULL,
	`content` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_review_comments_review_id_reviews_id_fk` FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY,
	`worktree_id` text NOT NULL,
	`worker_session_id` text,
	`reviewer_session_id` text,
	`iteration` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'agent_review' NOT NULL,
	`summary` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_reviews_worktree_id_worktrees_id_fk` FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`worktree_id` text,
	`parent_session_id` text,
	`role` text NOT NULL,
	`model_preference` text DEFAULT 'sonnet' NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_sessions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
	CONSTRAINT `fk_sessions_worktree_id_worktrees_id_fk` FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`)
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`options` text,
	`resolved` integer DEFAULT false NOT NULL,
	`resolved_content` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_signals_session_id_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`)
);
--> statement-breakpoint
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`branch_name` text NOT NULL,
	`path` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`dev_server_active` integer DEFAULT false NOT NULL,
	`linear_issue_id` text,
	`linear_issue_identifier` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_worktrees_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
