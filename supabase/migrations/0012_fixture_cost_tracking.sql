-- Part A5 — measure the cost model. Four optional numeric inputs (minutes)
-- on the ops fixture-resolution form, replacing the largest assumed
-- variable-cost line in the financial model with measured data.
alter table fixture add column minutes_question_set int check (minutes_question_set is null or minutes_question_set >= 0);
alter table fixture add column minutes_verification int check (minutes_verification is null or minutes_verification >= 0);
alter table fixture add column minutes_resolution int check (minutes_resolution is null or minutes_resolution >= 0);
alter table fixture add column minutes_sponsor_reporting int check (minutes_sponsor_reporting is null or minutes_sponsor_reporting >= 0);
