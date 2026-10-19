-- 0004 Superseded medical reviews keep their decision. Relax the decision pairing constraint accordingly.
alter table medical_reviews drop constraint medical_reviews_decision_pair;
alter table medical_reviews add constraint medical_reviews_decision_pair
  check ((status in ('decided', 'superseded') and decision is not null and decided_at is not null)
      or (status in ('assigned', 'in_progress') and decision is null and decided_at is null));
