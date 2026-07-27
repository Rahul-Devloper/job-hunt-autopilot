


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."email_source" AS ENUM (
    'community',
    'pattern',
    'hunter',
    'apollo',
    'manual'
);


ALTER TYPE "public"."email_source" OWNER TO "postgres";


CREATE TYPE "public"."email_type" AS ENUM (
    'generic',
    'personal'
);


ALTER TYPE "public"."email_type" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'captured',
    'email_found',
    'email_sent',
    'interview',
    'offer',
    'rejected'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_expired_extension_tokens"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM extension_tokens
  WHERE expires_at < NOW() OR revoked = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."clean_expired_extension_tokens"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."community_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_domain" "text" NOT NULL,
    "company_name" "text",
    "email" "text" NOT NULL,
    "email_type" "public"."email_type" DEFAULT 'generic'::"public"."email_type" NOT NULL,
    "verified_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "contributed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."community_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_discovery_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "method" "text",
    "contacts_found" integer DEFAULT 0,
    "api_calls_made" integer DEFAULT 0,
    "credits_used" integer DEFAULT 0,
    "success" boolean DEFAULT false,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "providers" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."contact_discovery_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."contact_discovery_logs"."method" IS 'Discovery method used: hunter, snov, getprospect, multi (multiple providers), manual, apollo, combined, error, none, etc.';



COMMENT ON COLUMN "public"."contact_discovery_logs"."providers" IS 'Array of providers used in this discovery: ["snov", "hunter", "getprospect"]';



CREATE TABLE IF NOT EXISTS "public"."email_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "community_email_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "worked" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emails_sent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "to_email" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "tracking_id" "text" NOT NULL,
    "opened_at" timestamp with time zone,
    "replied_at" timestamp with time zone,
    "sent_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "clicked_at" timestamp with time zone
);


ALTER TABLE "public"."emails_sent" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."extension_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "device_name" "text" DEFAULT 'Chrome Extension'::"text",
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '90 days'::interval),
    "revoked" boolean DEFAULT false
);


ALTER TABLE "public"."extension_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_sent_id" "uuid",
    "followup_number" integer NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."followup_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "contact_name" "text",
    "contact_role" "text",
    "contact_source" "text",
    "notes" "text",
    "is_primary" boolean DEFAULT false,
    "emails_sent" integer DEFAULT 0,
    "emails_opened" integer DEFAULT 0,
    "emails_clicked" integer DEFAULT 0,
    "emails_replied" integer DEFAULT 0,
    "last_contacted_at" timestamp with time zone,
    "first_response_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_poster" boolean DEFAULT false,
    CONSTRAINT "job_contacts_contact_source_check" CHECK (("contact_source" = ANY (ARRAY['linkedin'::"text", 'manual'::"text", 'company_website'::"text", 'referral'::"text", 'auto'::"text", 'poster'::"text", 'linkedin_people'::"text"])))
);


ALTER TABLE "public"."job_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "company_domain" "text",
    "job_title" "text" NOT NULL,
    "job_url" "text" NOT NULL,
    "job_description" "text",
    "location" "text",
    "salary" "text",
    "status" "public"."job_status" DEFAULT 'captured'::"public"."job_status" NOT NULL,
    "hr_email" "text",
    "hr_name" "text",
    "email_source" "public"."email_source",
    "applied_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email_type" "text",
    "poster_name" "text",
    "poster_title" "text",
    "poster_linkedin_url" "text",
    "company_linkedin_url" "text"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."link_clicks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "job_id" "uuid",
    "email_sent_id" "uuid",
    "link_type" "text" NOT NULL,
    "original_url" "text" NOT NULL,
    "tracking_id" "text" NOT NULL,
    "clicked_at" timestamp with time zone,
    "click_count" integer DEFAULT 0,
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."link_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_keys" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "apollo_api_key" "text",
    "hunter_api_key" "text",
    "apollo_credits_remaining" integer DEFAULT 0,
    "hunter_credits_remaining" integer DEFAULT 0,
    "last_checked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "email_finder_keys" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."user_api_keys" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_api_keys"."email_finder_keys" IS 'JSON structure for different provider types:

Snov.io (OAuth):
{
  "snov": {
    "client_id": "encrypted",
    "client_secret": "encrypted",
    "access_token": "encrypted",
    "token_expires_at": "2026-04-18T12:00:00Z",
    "is_active": true,
    "credits_remaining": 47
  }
}

Hunter/GetProspect (API Key):
{
  "hunter": {
    "api_key": "encrypted",
    "is_active": true,
    "credits_remaining": 23
  }
}';



CREATE TABLE IF NOT EXISTS "public"."user_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "is_master" boolean DEFAULT false,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['cv'::"text", 'cover_letter'::"text"])))
);


ALTER TABLE "public"."user_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_email_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email_address" "text" NOT NULL,
    "provider_name" "text",
    "smtp_host" "text" NOT NULL,
    "smtp_port" integer NOT NULL,
    "smtp_secure" boolean DEFAULT false,
    "smtp_user" "text" NOT NULL,
    "smtp_password_encrypted" "text" NOT NULL,
    "is_verified" boolean DEFAULT false,
    "is_primary" boolean DEFAULT false,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_email_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "hunter_api_key" "text",
    "apollo_api_key" "text",
    "auto_followup_enabled" boolean DEFAULT true,
    "followup_delay_days" integer DEFAULT 2,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "gmail_refresh_token" "text",
    "gmail_access_token" "text",
    "linkedin_url" "text",
    "email_provider" "text" DEFAULT 'gmail'::"text",
    "yahoo_email" "text",
    "yahoo_password_encrypted" "text",
    "professional_summary" "text",
    "full_name" "text",
    "contact_line" "text"
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "emails_contributed" integer DEFAULT 0,
    "emails_verified" integer DEFAULT 0,
    "helped_users_count" integer DEFAULT 0,
    "reputation_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_stats" OWNER TO "postgres";


ALTER TABLE ONLY "public"."community_emails"
    ADD CONSTRAINT "community_emails_company_domain_email_key" UNIQUE ("company_domain", "email");



ALTER TABLE ONLY "public"."community_emails"
    ADD CONSTRAINT "community_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_discovery_logs"
    ADD CONSTRAINT "contact_discovery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_community_email_id_user_id_key" UNIQUE ("community_email_id", "user_id");



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails_sent"
    ADD CONSTRAINT "emails_sent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails_sent"
    ADD CONSTRAINT "emails_sent_tracking_id_key" UNIQUE ("tracking_id");



ALTER TABLE ONLY "public"."extension_tokens"
    ADD CONSTRAINT "extension_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."extension_tokens"
    ADD CONSTRAINT "extension_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."followup_reminders"
    ADD CONSTRAINT "followup_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_tracking_id_key" UNIQUE ("tracking_id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_email_accounts"
    ADD CONSTRAINT "user_email_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_community_emails_contributor" ON "public"."community_emails" USING "btree" ("contributed_by");



CREATE INDEX "idx_community_emails_domain" ON "public"."community_emails" USING "btree" ("company_domain");



CREATE INDEX "idx_community_emails_verified" ON "public"."community_emails" USING "btree" ("verified_count" DESC);



CREATE INDEX "idx_discovery_logs_job" ON "public"."contact_discovery_logs" USING "btree" ("job_id");



CREATE INDEX "idx_discovery_logs_user" ON "public"."contact_discovery_logs" USING "btree" ("user_id");



CREATE INDEX "idx_email_verifications_email_id" ON "public"."email_verifications" USING "btree" ("community_email_id");



CREATE INDEX "idx_email_verifications_user_id" ON "public"."email_verifications" USING "btree" ("user_id");



CREATE INDEX "idx_emails_sent_job_id" ON "public"."emails_sent" USING "btree" ("job_id");



CREATE INDEX "idx_emails_sent_sent_at" ON "public"."emails_sent" USING "btree" ("sent_at" DESC);



CREATE INDEX "idx_emails_sent_tracking_id" ON "public"."emails_sent" USING "btree" ("tracking_id");



CREATE INDEX "idx_emails_sent_user_id" ON "public"."emails_sent" USING "btree" ("user_id");



CREATE INDEX "idx_extension_tokens_token" ON "public"."extension_tokens" USING "btree" ("token") WHERE (NOT "revoked");



CREATE INDEX "idx_extension_tokens_user_id" ON "public"."extension_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_followup_reminders_job_id" ON "public"."followup_reminders" USING "btree" ("job_id");



CREATE INDEX "idx_followup_reminders_scheduled" ON "public"."followup_reminders" USING "btree" ("scheduled_for");



CREATE INDEX "idx_followup_reminders_user_id" ON "public"."followup_reminders" USING "btree" ("user_id");



CREATE INDEX "idx_job_contacts_email" ON "public"."job_contacts" USING "btree" ("email");



CREATE INDEX "idx_job_contacts_job_id" ON "public"."job_contacts" USING "btree" ("job_id");



CREATE INDEX "idx_job_contacts_primary" ON "public"."job_contacts" USING "btree" ("job_id", "is_primary") WHERE ("is_primary" = true);



CREATE UNIQUE INDEX "idx_job_contacts_primary_unique" ON "public"."job_contacts" USING "btree" ("job_id") WHERE ("is_primary" = true);



CREATE UNIQUE INDEX "idx_job_contacts_unique_email" ON "public"."job_contacts" USING "btree" ("job_id", "email");



CREATE INDEX "idx_job_contacts_user_id" ON "public"."job_contacts" USING "btree" ("user_id");



CREATE INDEX "idx_jobs_company_domain" ON "public"."jobs" USING "btree" ("company_domain");



CREATE INDEX "idx_jobs_created_at" ON "public"."jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_jobs_status" ON "public"."jobs" USING "btree" ("status");



CREATE INDEX "idx_jobs_user_id" ON "public"."jobs" USING "btree" ("user_id");



CREATE INDEX "idx_link_clicks_email_sent_id" ON "public"."link_clicks" USING "btree" ("email_sent_id");



CREATE INDEX "idx_link_clicks_job_id" ON "public"."link_clicks" USING "btree" ("job_id");



CREATE INDEX "idx_link_clicks_tracking_id" ON "public"."link_clicks" USING "btree" ("tracking_id");



CREATE INDEX "idx_user_api_keys_email_finders" ON "public"."user_api_keys" USING "gin" ("email_finder_keys");



CREATE INDEX "idx_user_documents_master" ON "public"."user_documents" USING "btree" ("user_id", "is_master") WHERE ("is_master" = true);



CREATE UNIQUE INDEX "idx_user_documents_master_unique" ON "public"."user_documents" USING "btree" ("user_id", "document_type") WHERE ("is_master" = true);



CREATE INDEX "idx_user_documents_type" ON "public"."user_documents" USING "btree" ("user_id", "document_type");



CREATE INDEX "idx_user_documents_user_id" ON "public"."user_documents" USING "btree" ("user_id");



CREATE INDEX "idx_user_email_accounts_email" ON "public"."user_email_accounts" USING "btree" ("email_address");



CREATE INDEX "idx_user_email_accounts_primary" ON "public"."user_email_accounts" USING "btree" ("user_id", "is_primary") WHERE ("is_primary" = true);



CREATE INDEX "idx_user_email_accounts_user_id" ON "public"."user_email_accounts" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_user_primary_email" ON "public"."user_email_accounts" USING "btree" ("user_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_user_settings_user_id" ON "public"."user_settings" USING "btree" ("user_id");



CREATE INDEX "idx_user_stats_reputation" ON "public"."user_stats" USING "btree" ("reputation_score" DESC);



CREATE INDEX "idx_user_stats_user_id" ON "public"."user_stats" USING "btree" ("user_id");



ALTER TABLE ONLY "public"."community_emails"
    ADD CONSTRAINT "community_emails_contributed_by_fkey" FOREIGN KEY ("contributed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contact_discovery_logs"
    ADD CONSTRAINT "contact_discovery_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_discovery_logs"
    ADD CONSTRAINT "contact_discovery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_community_email_id_fkey" FOREIGN KEY ("community_email_id") REFERENCES "public"."community_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails_sent"
    ADD CONSTRAINT "emails_sent_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails_sent"
    ADD CONSTRAINT "emails_sent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."extension_tokens"
    ADD CONSTRAINT "extension_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_reminders"
    ADD CONSTRAINT "followup_reminders_email_sent_id_fkey" FOREIGN KEY ("email_sent_id") REFERENCES "public"."emails_sent"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_reminders"
    ADD CONSTRAINT "followup_reminders_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_reminders"
    ADD CONSTRAINT "followup_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_contacts"
    ADD CONSTRAINT "job_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_email_sent_id_fkey" FOREIGN KEY ("email_sent_id") REFERENCES "public"."emails_sent"("id");



ALTER TABLE ONLY "public"."link_clicks"
    ADD CONSTRAINT "link_clicks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id");



ALTER TABLE ONLY "public"."user_api_keys"
    ADD CONSTRAINT "user_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_documents"
    ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_email_accounts"
    ADD CONSTRAINT "user_email_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_stats"
    ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can update clicks (for tracking)" ON "public"."link_clicks" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view community emails" ON "public"."community_emails" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view user stats" ON "public"."user_stats" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view verifications" ON "public"."email_verifications" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can insert emails" ON "public"."community_emails" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert verifications" ON "public"."email_verifications" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Contributors can update their emails" ON "public"."community_emails" FOR UPDATE USING (("auth"."uid"() = "contributed_by"));



CREATE POLICY "Users can create own documents" ON "public"."user_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own email accounts" ON "public"."user_email_accounts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own extension tokens" ON "public"."extension_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own job contacts" ON "public"."job_contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own documents" ON "public"."user_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email accounts" ON "public"."user_email_accounts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own extension tokens" ON "public"."extension_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own job contacts" ON "public"."job_contacts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own jobs" ON "public"."jobs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own API keys" ON "public"."user_api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own clicks" ON "public"."link_clicks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own discovery logs" ON "public"."contact_discovery_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own emails" ON "public"."emails_sent" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own jobs" ON "public"."jobs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own reminders" ON "public"."followup_reminders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own sent emails" ON "public"."emails_sent" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own settings" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own stats" ON "public"."user_stats" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own verifications" ON "public"."email_verifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own API keys" ON "public"."user_api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own documents" ON "public"."user_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email accounts" ON "public"."user_email_accounts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own emails" ON "public"."emails_sent" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own extension tokens" ON "public"."extension_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own job contacts" ON "public"."job_contacts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own jobs" ON "public"."jobs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own reminders" ON "public"."followup_reminders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own settings" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own stats" ON "public"."user_stats" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all verifications" ON "public"."email_verifications" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view own API keys" ON "public"."user_api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own clicks" ON "public"."link_clicks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own discovery logs" ON "public"."contact_discovery_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own documents" ON "public"."user_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own email accounts" ON "public"."user_email_accounts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own emails" ON "public"."emails_sent" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own extension tokens" ON "public"."extension_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own job contacts" ON "public"."job_contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own jobs" ON "public"."jobs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own reminders" ON "public"."followup_reminders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sent emails" ON "public"."emails_sent" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own settings" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."community_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_discovery_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails_sent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."extension_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."link_clicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_email_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_stats" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."clean_expired_extension_tokens"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_expired_extension_tokens"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_expired_extension_tokens"() TO "service_role";


















GRANT ALL ON TABLE "public"."community_emails" TO "anon";
GRANT ALL ON TABLE "public"."community_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."community_emails" TO "service_role";



GRANT ALL ON TABLE "public"."contact_discovery_logs" TO "anon";
GRANT ALL ON TABLE "public"."contact_discovery_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_discovery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."email_verifications" TO "anon";
GRANT ALL ON TABLE "public"."email_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."emails_sent" TO "anon";
GRANT ALL ON TABLE "public"."emails_sent" TO "authenticated";
GRANT ALL ON TABLE "public"."emails_sent" TO "service_role";



GRANT ALL ON TABLE "public"."extension_tokens" TO "anon";
GRANT ALL ON TABLE "public"."extension_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."extension_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."followup_reminders" TO "anon";
GRANT ALL ON TABLE "public"."followup_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."job_contacts" TO "anon";
GRANT ALL ON TABLE "public"."job_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."job_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."link_clicks" TO "anon";
GRANT ALL ON TABLE "public"."link_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."link_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_documents" TO "anon";
GRANT ALL ON TABLE "public"."user_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_documents" TO "service_role";



GRANT ALL ON TABLE "public"."user_email_accounts" TO "anon";
GRANT ALL ON TABLE "public"."user_email_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_email_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_stats" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


  create policy "Users can delete own documents 1pyhs8m_0"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'user-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can upload own documents 1pyhs8m_0"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'user-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "Users can view own documents 1pyhs8m_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'user-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



