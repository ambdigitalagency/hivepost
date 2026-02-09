-- Add LBS fields to businesses: city, state, postal_code for local service area
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

COMMENT ON COLUMN public.businesses.city IS 'City for LBS / local reach';
COMMENT ON COLUMN public.businesses.state IS 'State (e.g. CA) for LBS';
COMMENT ON COLUMN public.businesses.postal_code IS 'Postal/ZIP code (optional)';
