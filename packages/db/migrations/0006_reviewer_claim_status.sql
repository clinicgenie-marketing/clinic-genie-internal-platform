-- 0006 Reviewers record decisions that move a claim between draft, under review, approved and rejected.
-- They need update (not insert or delete) on medical_claims for their clients.
create policy medical_claims_review_update on medical_claims for update
  using (app_can_review_client(client_id)) with check (app_can_review_client(client_id));
