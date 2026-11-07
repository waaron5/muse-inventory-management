CREATE TABLE "ai_change_count" (
	"user_id" text,
	"client_id" text,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "ai_change_count_pkey" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "ai_change_count" ADD CONSTRAINT "ai_change_count_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ai_change_count" ADD CONSTRAINT "ai_change_count_client_id_oauth_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "oauth_client"("client_id") ON DELETE CASCADE;