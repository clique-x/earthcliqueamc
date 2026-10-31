CREATE TYPE "public"."project_category" AS ENUM('cctv', 'network', 'servers', 'datacenter', 'other');--> statement-breakpoint
CREATE TYPE "public"."quote_item_kind" AS ENUM('material', 'labour', 'service', 'other');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'SUBMITTED', 'SHORTLISTED', 'REVISION_REQUESTED', 'AWARDED', 'REJECTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('SUBMITTED', 'OPEN', 'REJECTED', 'AWARDED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."rfq_actor_type" AS ENUM('company', 'vendor', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."vendor_doc_type" AS ENUM('gst', 'pan', 'registration', 'certification', 'other');--> statement-breakpoint
CREATE TYPE "public"."vendor_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"sort" integer NOT NULL,
	"kind" "quote_item_kind" NOT NULL,
	"description" text NOT NULL,
	"brand_model" text DEFAULT '' NOT NULL,
	"qty" real NOT NULL,
	"unit" text DEFAULT 'nos' NOT NULL,
	"unit_price" integer NOT NULL,
	"gst_percent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"gst_total" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"timeline_days" integer,
	"warranty_months" integer,
	"payment_terms" text DEFAULT '' NOT NULL,
	"valid_until" date,
	"notes" text DEFAULT '' NOT NULL,
	"survey_required" boolean DEFAULT false NOT NULL,
	"revision_note" text,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"name" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requirement_attachments_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE "requirement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"actor_type" "rfq_actor_type" NOT NULL,
	"actor_id" uuid,
	"from_status" "requirement_status",
	"to_status" "requirement_status",
	"note" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_vendors" (
	"requirement_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"match_rank" integer NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	CONSTRAINT "requirement_vendors_requirement_id_vendor_id_pk" PRIMARY KEY("requirement_id","vendor_id")
);
--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"company_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"raised_by" uuid NOT NULL,
	"category" "project_category" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"budget_min" integer,
	"budget_max" integer,
	"quote_deadline" timestamp with time zone NOT NULL,
	"start_by" date,
	"survey_allowed" boolean DEFAULT true NOT NULL,
	"status" "requirement_status" DEFAULT 'SUBMITTED' NOT NULL,
	"rejection_reason" text,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"max_quotes" integer NOT NULL,
	"awarded_quote_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "requirements_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "vendor_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"doc_type" "vendor_doc_type" NOT NULL,
	"file_key" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_documents_file_key_unique" UNIQUE("file_key")
);
--> statement-breakpoint
CREATE TABLE "vendor_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"role" "vendor_role" DEFAULT 'member' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"gstin" text NOT NULL,
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"categories" "project_category"[] DEFAULT '{}' NOT NULL,
	"states" text[] DEFAULT '{}' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"certifications" text[] DEFAULT '{}' NOT NULL,
	"team_size" integer,
	"founded_year" integer,
	"subscription_until" timestamp with time zone,
	"rating_avg" real DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"is_earthclique" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_gstin_unique" UNIQUE("gstin")
);
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_attachments" ADD CONSTRAINT "requirement_attachments_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_events" ADD CONSTRAINT "requirement_events_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_questions" ADD CONSTRAINT "requirement_questions_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_questions" ADD CONSTRAINT "requirement_questions_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_questions" ADD CONSTRAINT "requirement_questions_answered_by_company_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."company_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_vendors" ADD CONSTRAINT "requirement_vendors_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_vendors" ADD CONSTRAINT "requirement_vendors_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_raised_by_company_users_id_fk" FOREIGN KEY ("raised_by") REFERENCES "public"."company_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_documents" ADD CONSTRAINT "vendor_documents_verified_by_admins_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_users" ADD CONSTRAINT "vendor_users_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_requirement_vendor_idx" ON "quotes" USING btree ("requirement_id","vendor_id");--> statement-breakpoint
CREATE INDEX "quotes_vendor_idx" ON "quotes" USING btree ("vendor_id","updated_at");--> statement-breakpoint
CREATE INDEX "requirement_events_req_idx" ON "requirement_events" USING btree ("requirement_id","created_at");--> statement-breakpoint
CREATE INDEX "requirement_questions_req_idx" ON "requirement_questions" USING btree ("requirement_id","created_at");--> statement-breakpoint
CREATE INDEX "requirement_vendors_vendor_idx" ON "requirement_vendors" USING btree ("vendor_id","invited_at");--> statement-breakpoint
CREATE INDEX "requirements_company_idx" ON "requirements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "requirements_status_idx" ON "requirements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_users_email_idx" ON "vendor_users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "vendors_status_idx" ON "vendors" USING btree ("status");