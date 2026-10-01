-- One-time backfill: job_contacts is now the only source of truth for a job's
-- email contacts (it gates Send Email and the captured -> email_found move).
-- The removed "Add Email" / "Find Email" paths wrote only jobs.hr_email, so
-- those addresses never appeared in the Contacts popup. Copy each one into
-- job_contacts, skipping jobs that already have that address (case-insensitive).
-- It becomes primary only when the job has no primary contact yet.
-- Data-only; jobs.hr_email / hr_name / email_source / email_type are left in
-- place (no longer read or written by the app).

INSERT INTO public.job_contacts (job_id, user_id, email, contact_name, contact_source, is_primary, is_poster)
SELECT
  j.id,
  j.user_id,
  j.hr_email,
  j.hr_name,
  CASE WHEN j.email_source = 'manual' THEN 'manual' ELSE 'auto' END,
  NOT EXISTS (
    SELECT 1 FROM public.job_contacts p
    WHERE p.job_id = j.id AND p.is_primary
  ),
  false
FROM public.jobs j
WHERE j.hr_email IS NOT NULL
  AND btrim(j.hr_email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.job_contacts c
    WHERE c.job_id = j.id AND lower(c.email) = lower(j.hr_email)
  );
