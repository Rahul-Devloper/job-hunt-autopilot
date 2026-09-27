-- Follow-up to match_jobs (see 20260925164250/20260925165248): without this, a rejected job's
-- description was just as eligible as any active one — Ask JHA could recommend a job the user was
-- already rejected from as if it were a live opportunity. Excludes rejected jobs BEFORE ranking
-- (not after), so an excluded rejected job never displaces a genuinely relevant active one — the
-- top match_count results are simply the best among whatever's left once rejected rows are
-- removed from consideration.
--
-- exclude_rejected is a parameter (default true), not a hardcoded filter, so a future mode that
-- deliberately wants to search rejected applications (e.g. "what did I get rejected from that
-- wanted Kafka?") doesn't need another migration — it can just pass exclude_rejected := false.
--
-- Also returns "status" on every row, regardless of exclude_rejected's value, so a future
-- UI/generation layer can display a result's pipeline stage even when rejected rows aren't
-- excluded.
--
-- Adding a parameter changes the function's signature (name + argument types), so
-- CREATE OR REPLACE would create a second overload rather than replacing the existing 3-argument
-- version — dropping the old signature explicitly first avoids leaving a stale duplicate.
DROP FUNCTION IF EXISTS "public"."match_jobs"("extensions"."vector", integer, double precision);

CREATE OR REPLACE FUNCTION "public"."match_jobs"(
    "query_embedding" "extensions"."vector"(768),
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
  WHERE "jobs"."job_embedding" IS NOT NULL
    AND ("jobs"."job_embedding" OPERATOR("extensions".<=>) "query_embedding") < "max_distance"
    AND (NOT "exclude_rejected" OR "jobs"."status" <> 'rejected'::"public"."job_status")
  ORDER BY "distance" ASC
  LIMIT "match_count";
$$;

ALTER FUNCTION "public"."match_jobs"("extensions"."vector", integer, double precision, boolean) OWNER TO "postgres";
