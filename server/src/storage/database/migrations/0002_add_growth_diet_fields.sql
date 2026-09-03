-- 成长记录新增「今日饮食反馈」等 7 个可空字段
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS diet_overall varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS diet_vegetable varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS diet_meat varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS diet_soup varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS diet_water varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS nap_status varchar(20);
ALTER TABLE growth_records ADD COLUMN IF NOT EXISTS stool_status varchar(20);
