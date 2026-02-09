-- Add image_prompt to posts: stores visual prompt for image generation (from caption conversion)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_prompt TEXT;
COMMENT ON COLUMN public.posts.image_prompt IS 'Visual prompt for SDXL, derived from caption';
