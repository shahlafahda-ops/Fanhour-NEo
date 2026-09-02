-- Part A4 — sponsor value evidence beyond redemption. One optional,
-- skippable, no-PII tap at the merchant portal after a successful
-- redemption: "is this your first visit?" — null means never asked/skipped.
alter table redemption_log add column first_visit text
  check (first_visit is null or first_visit in ('yes', 'no', 'unsure'));
