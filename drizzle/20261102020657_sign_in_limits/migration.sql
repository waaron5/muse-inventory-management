CREATE TABLE "sign_in_count" (
	"key" text,
	"window_start" timestamp with time zone,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sign_in_count_pkey" PRIMARY KEY("key","window_start")
);
