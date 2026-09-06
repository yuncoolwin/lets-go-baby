-- 成长记录媒体过期标记：照片/视频过期后占位展示，文件由定时任务清理
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS photo_expired boolean NOT NULL DEFAULT false;
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS video_expired boolean NOT NULL DEFAULT false;