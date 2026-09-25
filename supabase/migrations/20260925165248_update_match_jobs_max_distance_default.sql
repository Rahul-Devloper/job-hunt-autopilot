-- Follow-up to 20260925164250_add_match_jobs_function.sql: that migration shipped with a
-- placeholder max_distance default (0.5) pending empirical determination. This updates it to the
-- value actually justified by real data (0.494) — see that migration's own comment and
-- private_docs/ask-jha-retrieval/_TASKS-COMPLETED.md for the full empirical test data.
--
-- A separate migration rather than editing the original file, since the original migration
-- already ran against production with the placeholder default — migration history shouldn't be
-- rewritten after the fact. (The original file in this repo has also been updated to the final
-- default, so a fresh `supabase db reset` produces the correct end state directly.)
CREATE OR REPLACE FUNCTION "public"."match_jobs"(
    "query_embedding" "extensions"."vector"(768),
    "match_count" integer DEFAULT 5,
    "max_distance" double precision DEFAULT 0.494
) RETURNS TABLE(
    "id" "uuid",
    "job_title" "text",
    "company_name" "text",
    "job_description" "text",
    "job_url" "text",
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
    ("jobs"."job_embedding" OPERATOR("extensions".<=>) "query_embedding") AS "distance"
  FROM "public"."jobs"
  WHERE "jobs"."job_embedding" IS NOT NULL
    AND ("jobs"."job_embedding" OPERATOR("extensions".<=>) "query_embedding") < "max_distance"
  ORDER BY "distance" ASC
  LIMIT "match_count";
$$;

ALTER FUNCTION "public"."match_jobs"("extensions"."vector", integer, double precision) OWNER TO "postgres";
