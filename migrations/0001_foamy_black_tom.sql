ALTER TABLE "owners" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "status" text DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "bedrooms" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "bathrooms" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "square_feet" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "year_built" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "arv" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "max_offer" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_sale_price" text;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "last_sale_date" timestamp;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "lead_type" text;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;