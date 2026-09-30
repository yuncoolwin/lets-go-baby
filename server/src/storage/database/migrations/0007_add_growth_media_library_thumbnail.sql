ALTER TABLE growth_media_library
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path text;