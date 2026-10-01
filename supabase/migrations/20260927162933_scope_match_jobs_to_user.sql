-- match_jobs never filtered by user_id — every call searched every user's embedded jobs. Harmless
-- while this app has one real account, but wiring a genuinely authenticated API route on top of an
-- RPC with no ownership check makes that auth check hollow: it verifies who is asking, not what
-- they're allowed to see, which breaks this project's own convention everywhere else (every
-- `jobs` RLS policy is `auth.uid() = user_id`). Fixing now, before this RPC gets a real caller
-- through the app rather than only a same-account CLI script.
--
-- p_user_id is required (no default) — every caller must explicitly decide whose jobs to search,
-- rather than being able to silently omit it and get everyone's.
DROP FUNCTION IF EXISTS "public"."match_jobs"("extensions"."vector", integer, double precision, boolean);

CREATE OR REPLACE FUNCTION "public"."match_jobs"(
    "query_embedding" "extensions"."vector"(768),
    "p_user_id" "uuid",
    "match_count" integer DEFAULT 5,
    "max_distance" double precision DEFAULT 0.494,
    "exclude_rejected" boolean DEFAULT true
) RETURNS TABLE(
    "id" "uuid",
    "job_title" "text",
    "company_name" "text",
    "job_description" "text",
    "job_url" "text",
    "status" "public"."job_status",
    "distance" double precision
)
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    "jobs"."id",
    "jobs"."job_title",
    "jobs"."company_name",
    "jobs"."job_description",
    "jobs"."job_url",
    "jobs"."status",
    ("jobs"."job_embedding" OPERATOR("extensions".<=>) "query_embedding") AS "distance"
  FROM "public"."jobs"
  WHERE "jobs"."user_id" = "p_user_id"
    AND "jobs"."job_embedding" IS NOT NULL
    AND ("jobs"."job_embedding" OPERATOR("extensions".<=>) "query_embedding") < "max_distance"
    AND (NOT "exclude_rejected" OR "jobs"."status" <> 'rejected'::"public"."job_status")
  ORDER BY "distance" ASC
  LIMIT "match_count";
$$;

ALTER FUNCTION "public"."match_jobs"("extensions"."vector", "uuid", integer, double precision, boolean) OWNER TO "postgres";
