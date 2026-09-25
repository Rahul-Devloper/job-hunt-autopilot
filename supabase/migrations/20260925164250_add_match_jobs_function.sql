-- This creates a Postgres RPC function that lives inside the database itself — it is not
-- application code. The app never runs this query directly; it calls into Postgres by name via
-- `supabase.rpc('match_jobs', { ... })` (see lib/retrieval.ts), and Postgres executes the SQL
-- below server-side. This keeps the vector similarity search (job_embedding <=> query_embedding)
-- next to the data and the HNSW index it relies on, instead of pulling all embeddings over the
-- wire and computing distance in application code.
--
-- max_distance's default (0.494) is empirically chosen, not guessed: against the 23 real
-- production jobs, every job-domain test question (whether the asked-about technology genuinely
-- appeared in the dataset or not) scored between 0.2929 and 0.4930 cosine distance; every
-- genuinely off-topic question (unrelated to jobs/tech entirely) scored 0.4951 and up. 0.494 sits
-- in that empirically observed gap. See private_docs/ask-jha-retrieval/_TASKS-COMPLETED.md for the
-- full test data — note the gap is narrow (~0.002 wide) and based on a small sample (23 jobs, 12
-- test questions), so treat this as a first estimate to refine as real usage accumulates more
-- data, not a permanently fixed constant.
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
