-- By-hand sales no longer store separate location/district; address covers delivery details.
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS location;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS district;
