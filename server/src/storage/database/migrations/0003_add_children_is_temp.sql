-- 临时来园支持未建档新幼儿：children 表新增 is_temp 标记字段
ALTER TABLE children ADD COLUMN IF NOT EXISTS is_temp boolean NOT NULL DEFAULT false;