-- Drop the pre-contacts email fields. Since 20261001072957 (backfill) and the
-- removal of Add Email / Find Email, job_contacts is the only source of a
-- job's contacts; nothing reads or writes these objects any more.
--
-- Plain DROPs (no CASCADE, no IF EXISTS): if anything unexpected still
-- depends on one of these, the migration fails instead of silently taking
-- the dependent object with it.

-- Carry over any HR name the backfill couldn't place (contact existed
-- already, without a name), so dropping hr_name loses no names.
UPDATE public.job_contacts c
SET contact_name = j.hr_name,
    updated_at = now()
FROM public.jobs j
WHERE c.job_id = j.id
  AND j.hr_name IS NOT NULL
  AND btrim(j.hr_name) <> ''
  AND c.contact_name IS NULL
  AND lower(c.email) = lower(j.hr_email);

ALTER TABLE public.jobs
  DROP COLUMN hr_email,
  DROP COLUMN hr_name,
  DROP COLUMN email_source,
  DROP COLUMN email_type;

-- email_verifications only recorded votes on community_emails rows
-- (NOT NULL FK); it has no meaning without them.
DROP TABLE public.email_verifications;
DROP TABLE public.community_emails;

DROP TYPE public.email_source;
DROP TYPE public.email_type;
