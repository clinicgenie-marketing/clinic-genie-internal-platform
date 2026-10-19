-- 0007 Reviewers act on issues and evidence for their clients.
-- The application layer (createIssueAction, transitionIssueAction, addEvidenceAction) lets a
-- reviewer open issues, verify/reopen them and attach evidence, but 0002 only granted write access
-- via app_can_edit_client (admin/manager/specialist). Without these policies the reviewer workflow
-- fails at the database with error 42501. These add the matching row-level security for reviewers.
create policy issues_review_insert on issues for insert
  with check (app_can_review_client(client_id));
create policy issues_review_update on issues for update
  using (app_can_review_client(client_id)) with check (app_can_review_client(client_id));

create policy issue_history_review_insert on issue_history for insert
  with check (app_can_review_client(client_id));

create policy evidence_items_review_insert on evidence_items for insert
  with check (app_can_review_client(client_id));
