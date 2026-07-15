CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"file_size" bigint NOT NULL,
	"s3_key" text NOT NULL,
	"message" text,
	"password_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"verify_attempts" integer DEFAULT 0 NOT NULL,
	"verify_window_start" timestamp with time zone
);
