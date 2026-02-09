-- NOTE: Create storage bucket "business-materials" (public or private) in Supabase Dashboard
-- if not exists. The /api/business/[id]/materials route uploads to this bucket.

-- Add website_url to businesses for user-provided website
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS website_url TEXT;
COMMENT ON COLUMN public.businesses.website_url IS 'User-provided website URL for context';

-- business_materials: uploaded flyers, designs, etc. Storage path stored here
CREATE TABLE IF NOT EXISTS public.business_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_materials_business_id ON public.business_materials(business_id);
