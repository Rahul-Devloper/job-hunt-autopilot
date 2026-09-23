ALTER TABLE "public"."jobs"
  ADD COLUMN "job_embedding" "extensions"."vector"(768);

CREATE INDEX "jobs_job_embedding_hnsw_idx"
  ON "public"."jobs"
  USING "hnsw" ("job_embedding" "extensions"."vector_cosine_ops");
