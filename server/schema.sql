CREATE TABLE `reports` (
	`key` text PRIMARY KEY NOT NULL,
	`rev` integer NOT NULL,
	`section` text,
	`name` text,
	`lon` real,
	`lat` real,
	`species` text,
	`len` real,
	`qty` integer,
	`day` text,
	`touched` text NOT NULL,
	`writer` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `report_day` ON `reports` (`day`);--> statement-breakpoint
CREATE INDEX `report_section_day` ON `reports` (`section`,`day`);--> statement-breakpoint
CREATE INDEX `report_expiry` ON `reports` (`touched`);--> statement-breakpoint
CREATE INDEX `report_writer` ON `reports` (`writer`,`touched`);
CREATE TABLE `report_quota_days` (
	`day` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL
);
