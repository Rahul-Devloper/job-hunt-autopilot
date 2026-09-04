-- Drop the existing constraint
ALTER TABLE link_clicks 
DROP CONSTRAINT link_clicks_job_id_fkey;

-- Re-add it with ON DELETE CASCADE
ALTER TABLE link_clicks 
ADD CONSTRAINT link_clicks_job_id_fkey 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;