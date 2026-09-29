-- 素材箱：教师/管理/超管共享的上传媒体库（图片/视频），不与成长档案 60 天互相干扰
CREATE TABLE IF NOT EXISTS growth_media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_path text NOT NULL,
  url text,
  uploader_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_media_library_created_at
  ON growth_media_library (created_at);