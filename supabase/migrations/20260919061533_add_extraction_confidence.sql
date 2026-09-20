-- Scraper resilience layer: track how confident the extension is in a captured job's data.
-- 'ok' = all critical fields (company name, job title) came from a stable/known selector.
-- 'degraded' = a critical field only matched its last-resort fallback selector.
-- 'failed' = a critical field could not be extracted at all.
CREATE TYPE "public"."extraction_confidence" AS ENUM (
    'ok',
    'degraded',
    'failed'
);

ALTER TYPE "public"."extraction_confidence" OWNER TO "postgres";

ALTER TABLE "public"."jobs"
    ADD COLUMN "extraction_confidence" "public"."extraction_confidence" DEFAULT 'ok'::"public"."extraction_confidence" NOT NULL;
