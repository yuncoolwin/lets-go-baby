-- 云端草稿表：跨设备同步成长档案草稿（媒体存原始 storage path，便于草稿/发布时重签 URL）
CREATE TABLE IF NOT EXISTS growth_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id text,
  child_name text,
  course_id text,
  course_name text,
  title text,
  content text,
  photo_paths jsonb DEFAULT '[]'::jsonb,
  video_paths jsonb DEFAULT '[]'::jsonb,
  record_date text,
  diet_overall text,
  diet_vegetable text,
  diet_meat text,
  diet_soup text,
  diet_water text,
  nap_status text,
  stool_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_drafts_user_updated ON growth_drafts (user_id, updated_at DESC);