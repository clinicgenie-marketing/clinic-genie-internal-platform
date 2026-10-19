-- 0005 Superseding a snapshot writes the pointer on the old row before the new row exists, so the
-- forward pointer cannot be a foreign key. The backward pointer (supersedes_id) stays a foreign key.
alter table report_snapshots drop constraint report_snapshots_superseded_by_id_fkey;
