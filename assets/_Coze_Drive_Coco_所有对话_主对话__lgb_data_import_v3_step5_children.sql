-- 第5步：导入幼儿 31 条
INSERT INTO children (id, name, gender, birth_date, notes, parent_phone, class_id, status, start_date) VALUES
  ('ca3412bd-b929-59bc-b71f-2b29973541c5', '魏铭嘉', 'male', NULL, NULL, NULL, 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'graduated', '2025-02-17'),
  ('7780abf5-095d-5a64-adf3-228bb9e99cec', '梁姝语', 'female', NULL, NULL, NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'graduated', '2025-02-18'),
  ('91389f14-a71d-57f8-8ed0-6de5dedadef9', '孙恺宁', 'male', NULL, NULL, NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'graduated', '2025-03-03'),
  ('90538b66-7bdc-576b-b720-01721ae4a70b', '黄程焕', 'male', NULL, NULL, NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'graduated', '2025-05-20'),
  ('acabf8be-5e84-5840-afb8-f191076d118f', '宋煜辰', 'male', NULL, NULL, NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-06-02'),
  ('1c6a4ea4-8db0-5016-addf-aa3107c6fa5b', '孙韵珊', 'female', '2022-12-23', '家长：陈笑芳（母亲）', NULL, 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'graduated', '2025-02-10'),
  ('32adf0e6-31c7-5cd8-86bc-50808a3282e5', '李潇月', 'female', '2023-09-23', '家长：留钰翔（母亲）', '15537659292', 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'graduated', '2025-04-04'),
  ('a8ae8594-8793-5549-ab98-f860197f11f9', '覃隽逸', 'male', '2023-04-12', '家长：许雪梅（母亲）', '13631759558', 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'graduated', '2025-10-20'),
  ('850a5303-b795-5d28-9b10-ef33c6a4f807', '陈佳乐', 'male', '2023-10-31', '家长：张敏（母亲）', '15989756784', 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'suspended', '2025-10-14'),
  ('4e2a482f-ed39-52fb-8474-21f9ce2a991a', '龚如一', 'female', '2023-11-21', '家长：洪智娟（母亲）', '13427860054', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2025-10-27'),
  ('166ea34a-4008-5cc2-b550-01f73982ee11', '雷特瑞', 'male', '2023-12-03', '家长：李慧平（母亲）', '13827296482', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2025-10-10'),
  ('284a6411-8637-5057-aacb-9becedf1030d', '莫雅恬', 'female', '2022-11-15', '家长：夏瑞娟（母亲）', '13538585624', 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'graduated', '2025-12-16'),
  ('f2c12f96-8bed-5163-8d43-b76b68d4d39a', '刘予墨', 'male', '2024-09-10', '家长：刘青（父亲）', '15580172013', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2026-04-09'),
  ('94c897b3-d25e-535a-8d44-a5da540a609c', '赵浩丞', 'male', '2023-06-18', '家长：李秄轩（母亲）', '15397156607', 'c1d763d7-a7f7-4386-976b-ecbb105b1d82', 'suspended', '2026-04-01'),
  ('713c8ae4-8060-5a29-91a6-f720511783ae', '谭文昊', 'male', '2024-08-13', '家长：谢晓霞（母亲）', '15014815253', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-03-25'),
  ('5405418c-372f-51aa-88f3-6fb28c7ccd08', '孙毅朗', 'male', '2024-01-06', '家长：刘艳婷（母亲）', '13662872180', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-05-08'),
  ('d5292de1-19e2-5864-b79a-c9c82c70f0df', '廖可言', 'female', '2024-08-17', '家长：冯梅香（母亲）', '13238381242', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-06-08'),
  ('1c6df2ca-6584-5830-ba44-ec06b69b45fd', '陈沁玥', 'female', '2024-04-15', '家长：卢莉娴（母亲）', '13686118622', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-06-29'),
  ('d661e401-668e-527f-a1c0-8987b626cf9b', '温文涛', 'male', '2024-03-21', '家长：凌梅梅（母亲）', '18938257784', 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2026-07-06'),
  ('b59e9d53-446d-5961-b9bf-a8a606dcd204', '孙铭禧', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-07-03'),
  ('1e16d60c-9102-51f3-939d-c875e8dd44d2', '廖天成', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', NULL),
  ('bdff5531-6a3c-5300-927b-1b31a8e4db55', '张筱悠', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-02-02'),
  ('b76aa2de-ae39-59a1-bbd8-76f9d2bceb8f', '徐乐悠', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-01-28'),
  ('ac68f7d2-03e7-547c-9592-71518b4eea0b', '欧恒铭', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-10-09'),
  ('eb49cdea-ec2b-5071-a62e-4b5000fab2b0', '逯子菀', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-03-08'),
  ('a92c51cb-6e22-5a7f-ab52-75a698ba85e3', '邓颂雯', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2026-02-05'),
  ('185f18ff-a1af-5e55-b691-ee1d3eb25bf2', '郭千予', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-07-01'),
  ('67af80ec-01bd-5523-9630-f1f55462c0fc', '陈天琪', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2025-09-06'),
  ('3815afee-fd26-5497-80f4-06cbb689ece6', '黄洛熙', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'suspended', '2025-07-03'),
  ('58667104-ff4a-5578-84ec-ca5b348027a1', '黄瑞恒', 'unknown', NULL, '临时学员（台账报课，无花名册档案）', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2026-05-09'),
  ('b19c39b0-d0cd-5b1f-ba6c-7423c780e1fc', '孙昕彤', 'unknown', NULL, '仅考勤记录，无花名册/台账档案', NULL, 'bfc3e9f8-ae31-4d33-ad15-bc725192effc', 'active', '2026-08-03');

-- 验证
SELECT COUNT(*) AS children_count FROM children;
SELECT name, gender, status, class_id, start_date FROM children ORDER BY name;