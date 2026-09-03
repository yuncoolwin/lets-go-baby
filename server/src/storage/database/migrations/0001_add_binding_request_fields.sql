-- 首次绑定幼儿：新增可填写的幼儿扩展信息字段
-- gender: 幼儿性别（男/女）; birth_date: 出生日期; parent_phone: 家长电话
ALTER TABLE binding_requests ADD COLUMN IF NOT EXISTS gender varchar(10);
ALTER TABLE binding_requests ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE binding_requests ADD COLUMN IF NOT EXISTS parent_phone varchar(20);

-- children 表兜底（正常情况下已存在）
ALTER TABLE children ADD COLUMN IF NOT EXISTS gender varchar(10);
ALTER TABLE children ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE children ADD COLUMN IF NOT EXISTS parent_phone varchar(20);
ALTER TABLE children ADD COLUMN IF NOT EXISTS nickname varchar(64);
ALTER TABLE children ADD COLUMN IF NOT EXISTS allergies text;
