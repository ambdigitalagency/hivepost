-- Run this in Supabase Dashboard → SQL Editor if you see:
--   Could not find the 'website_url' column of 'businesses' in the schema cache
-- Adds optional website_url to businesses (safe to run multiple times).

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website_url TEXT;
COMMENT ON COLUMN public.businesses.website_url IS 'User-provided website URL for context';
