-- 0003 Grants for the application role cg_app (created by the migration runner).
grant usage on schema public to cg_app;
grant select, insert, update on all tables in schema public to cg_app;
grant usage, select on all sequences in schema public to cg_app;
revoke update on audit_events, task_history, issue_history, claim_wordings, timeline_events from cg_app;
revoke delete on all tables in schema public from cg_app;
grant delete on dev_magic_links, verification_token, sessions, accounts, users to cg_app;
alter default privileges in schema public grant select, insert, update on tables to cg_app;
alter default privileges in schema public grant usage, select on sequences to cg_app;
