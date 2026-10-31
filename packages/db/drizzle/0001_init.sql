CREATE TYPE "public"."actor_type" AS ENUM('company', 'engineer', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."category" AS ENUM('pc', 'network', 'cctv');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('freelance', 'staff');--> statement-breakpoint
CREATE TYPE "public"."engineer_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."kyc_doc_type" AS ENUM('aadhaar', 'pan', 'selfie', 'other');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('issue', 'before', 'after');--> statement-breakpoint
CREATE TYPE "public"."offer_response" AS ENUM('accepted', 'declined', 'timeout', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('normal', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'SEARCHING', 'UNASSIGNED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'REMOTE_RESOLVED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gstin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"role" "company_role" DEFAULT 'user' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispatch_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"engineer_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"wave" integer NOT NULL,
	"distance_km" real NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"response" "offer_response"
);
--> statement-breakpoint
CREATE TABLE "engineer_kyc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engineer_id" uuid NOT NULL,
	"doc_type" "kyc_doc_type" NOT NULL,
	"file_key" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"photo_key" text,
	"status" "engineer_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"employment_type" "employment_type" DEFAULT 'freelance' NOT NULL,
	"skills" "category"[] DEFAULT '{}' NOT NULL,
	"service_radius_km" integer DEFAULT 15 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_location" geography(Point,4326),
	"last_seen_at" timestamp with time zone,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"acceptance_rate" real DEFAULT 1 NOT NULL,
	"cooldown_until" timestamp with time zone,
	"fcm_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engineers_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "location_pings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engineer_id" uuid NOT NULL,
	"ticket_id" uuid,
	"location" geography(Point,4326) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"phone" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"ticket_id" uuid NOT NULL,
	"from_type" "actor_type" NOT NULL,
	"score" integer NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_ticket_id_from_type_pk" PRIMARY KEY("ticket_id","from_type")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address" text NOT NULL,
	"location" geography(Point,4326) NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" uuid,
	"from_status" "ticket_status",
	"to_status" "ticket_status",
	"note" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"uploader_type" "actor_type" NOT NULL,
	"uploader_id" uuid NOT NULL,
	"kind" "media_kind" NOT NULL,
	"file_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_media_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE "ticket_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"name" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"needs_approval" boolean NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"category" "category" NOT NULL,
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"triage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"engineer_id" uuid,
	"dispatch_round" integer DEFAULT 0 NOT NULL,
	"current_wave" integer DEFAULT 0 NOT NULL,
	"start_otp" text,
	"close_otp" text,
	"fee_estimate" integer NOT NULL,
	"fee_final" integer,
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "tickets_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispatch_offers" ADD CONSTRAINT "dispatch_offers_engineer_id_engineers_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."engineers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_kyc" ADD CONSTRAINT "engineer_kyc_engineer_id_engineers_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."engineers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_kyc" ADD CONSTRAINT "engineer_kyc_verified_by_admins_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_engineer_id_engineers_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."engineers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_pings" ADD CONSTRAINT "location_pings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_media" ADD CONSTRAINT "ticket_media_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_parts" ADD CONSTRAINT "ticket_parts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_parts" ADD CONSTRAINT "ticket_parts_approved_by_company_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."company_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raised_by_company_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."company_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_engineer_id_engineers_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."engineers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_users_email_idx" ON "company_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "dispatch_offers_ticket_idx" ON "dispatch_offers" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "dispatch_offers_engineer_idx" ON "dispatch_offers" USING btree ("engineer_id","sent_at");--> statement-breakpoint
CREATE INDEX "engineers_location_idx" ON "engineers" USING gist ("last_location");--> statement-breakpoint
CREATE INDEX "engineers_status_online_idx" ON "engineers" USING btree ("status","is_online");--> statement-breakpoint
CREATE INDEX "location_pings_ticket_idx" ON "location_pings" USING btree ("ticket_id","recorded_at");--> statement-breakpoint
CREATE INDEX "sites_company_idx" ON "sites" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "ticket_events" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_media_ticket_idx" ON "ticket_media" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_company_created_idx" ON "tickets" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "tickets_engineer_idx" ON "tickets" USING btree ("engineer_id");