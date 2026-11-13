-- Postgres rejects offset labels like GMT+0530; store IANA names only.

UPDATE public.branches
SET timezone = 'Asia/Kolkata'
WHERE lower(btrim(timezone)) IN (
      'gmt+0530', 'gmt+05:30', 'gmt+5:30', 'ist', 'india standard time'
    )
   OR lower(btrim(timezone)) ~ '^gmt\+?0?5[:.]?30$';

UPDATE public.branches
SET timezone = 'Asia/Dubai'
WHERE lower(btrim(timezone)) ~ '^gmt\+?0?4[:.]?00$'
   OR lower(btrim(timezone)) IN ('gst', 'gulf standard time');

UPDATE public.branches
SET timezone = 'Asia/Dubai'
WHERE timezone IS NULL
   OR btrim(timezone) = ''
   OR timezone !~ '^[A-Za-z]+/';
