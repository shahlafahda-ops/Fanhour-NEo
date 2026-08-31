-- Campaign benefit image (prize photo). Mirrors the existing sponsor.logo_url
-- column: nullable, purely presentational, never used for eligibility.
alter table campaign add column image_url text;
