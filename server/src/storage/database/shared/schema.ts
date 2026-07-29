import { pgTable, serial, timestamp, varchar, text, boolean, integer, date, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// System table - DO NOT DELETE
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ========== 用户基础表 ==========
export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    openid: varchar("openid", { length: 128 }).unique(),
    unionid: varchar("unionid", { length: 128 }),
    nickname: varchar("nickname", { length: 128 }).notNull().default(""),
    avatar_url: varchar("avatar_url", { length: 512 }),
    phone: varchar("phone", { length: 20 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_openid_idx").on(table.openid),
  ]
);

// ========== 角色表（账户三层分离核心） ==========
export const user_roles = pgTable(
  "user_roles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
    role_type: varchar("role_type", { length: 20 }).notNull(), // 'parent', 'teacher', 'admin'
    real_name: varchar("real_name", { length: 64 }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("user_roles_user_id_idx").on(table.user_id),
    index("user_roles_role_type_idx").on(table.role_type),
  ]
);

// ========== 幼儿表 ==========
export const children = pgTable(
  "children",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 64 }).notNull(),
    gender: varchar("gender", { length: 10 }).notNull().default("unknown"), // 'male', 'female', 'unknown'
    birth_date: date("birth_date"),
    avatar_url: varchar("avatar_url", { length: 512 }),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("children_name_idx").on(table.name),
  ]
);

// ========== 家长-幼儿关系表 ==========
export const parent_child_relations = pgTable(
  "parent_child_relations",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    parent_role_id: varchar("parent_role_id", { length: 36 }).notNull().references(() => user_roles.id),
    child_id: varchar("child_id", { length: 36 }).notNull().references(() => children.id),
    relationship: varchar("relationship", { length: 20 }).notNull(), // 'father', 'mother', 'guardian'
    is_primary: boolean("is_primary").default(false).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'approved', 'rejected'
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pcr_parent_role_id_idx").on(table.parent_role_id),
    index("pcr_child_id_idx").on(table.child_id),
    index("pcr_status_idx").on(table.status),
  ]
);

// ========== 班级表 ==========
export const classes = pgTable(
  "classes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 64 }).notNull(),
    description: text("description"),
    min_age_months: integer("min_age_months"),
    max_age_months: integer("max_age_months"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("classes_status_idx").on(table.status),
  ]
);

// ========== 班级成员表 ==========
export const class_members = pgTable(
  "class_members",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    class_id: varchar("class_id", { length: 36 }).notNull().references(() => classes.id),
    member_type: varchar("member_type", { length: 20 }).notNull(), // 'teacher', 'student'
    member_id: varchar("member_id", { length: 36 }).notNull(), // user_roles.id (teacher) or children.id (student)
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("class_members_class_id_idx").on(table.class_id),
    index("class_members_member_idx").on(table.member_type, table.member_id),
  ]
);

// ========== 考勤/接送记录表 ==========
export const attendance_records = pgTable(
  "attendance_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    child_id: varchar("child_id", { length: 36 }).notNull().references(() => children.id),
    class_id: varchar("class_id", { length: 36 }).notNull().references(() => classes.id),
    record_date: date("record_date").notNull(),
    check_in_time: timestamp("check_in_time", { withTimezone: true }),
    check_out_time: timestamp("check_out_time", { withTimezone: true }),
    check_in_by: varchar("check_in_by", { length: 36 }),
    check_out_by: varchar("check_out_by", { length: 36 }),
    status: varchar("status", { length: 20 }).notNull().default("present"), // 'present', 'absent', 'leave'
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("attendance_child_id_idx").on(table.child_id),
    index("attendance_class_id_idx").on(table.class_id),
    index("attendance_date_idx").on(table.record_date),
    index("attendance_status_idx").on(table.status),
  ]
);

// ========== 每日反馈表 ==========
export const daily_feedbacks = pgTable(
  "daily_feedbacks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    child_id: varchar("child_id", { length: 36 }).notNull().references(() => children.id),
    teacher_id: varchar("teacher_id", { length: 36 }).notNull().references(() => user_roles.id),
    feedback_date: date("feedback_date").notNull(),
    meal_status: varchar("meal_status", { length: 50 }), // 'good', 'normal', 'poor'
    sleep_status: varchar("sleep_status", { length: 50 }), // 'good', 'normal', 'poor'
    mood_status: varchar("mood_status", { length: 50 }), // 'happy', 'normal', 'upset'
    activities: text("activities"),
    notes: text("notes"),
    photo_urls: jsonb("photo_urls"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("feedbacks_child_id_idx").on(table.child_id),
    index("feedbacks_teacher_id_idx").on(table.teacher_id),
    index("feedbacks_date_idx").on(table.feedback_date),
  ]
);

// ========== 成长记录表 ==========
export const growth_records = pgTable(
  "growth_records",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    child_id: varchar("child_id", { length: 36 }).notNull().references(() => children.id),
    teacher_id: varchar("teacher_id", { length: 36 }).notNull().references(() => user_roles.id),
    record_type: varchar("record_type", { length: 30 }).notNull(), // 'milestone', 'photo', 'assessment'
    title: varchar("title", { length: 128 }).notNull(),
    content: text("content"),
    photo_urls: jsonb("photo_urls"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("growth_child_id_idx").on(table.child_id),
    index("growth_teacher_id_idx").on(table.teacher_id),
    index("growth_type_idx").on(table.record_type),
    index("growth_created_at_idx").on(table.created_at),
  ]
);

// ========== 通知表 ==========
export const notifications = pgTable(
  "notifications",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 128 }).notNull(),
    content: text("content").notNull(),
    type: varchar("type", { length: 30 }).notNull(), // 'system', 'class', 'activity'
    sender_id: varchar("sender_id", { length: 36 }),
    target_type: varchar("target_type", { length: 20 }).notNull().default("all"), // 'all', 'class', 'parent'
    target_id: varchar("target_id", { length: 36 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_type_idx").on(table.type),
    index("notifications_target_idx").on(table.target_type, table.target_id),
    index("notifications_created_at_idx").on(table.created_at),
  ]
);

// ========== 绑定审核请求表 ==========
export const binding_requests = pgTable(
  "binding_requests",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    parent_role_id: varchar("parent_role_id", { length: 36 }).notNull().references(() => user_roles.id),
    child_name: varchar("child_name", { length: 64 }).notNull(),
    child_id: varchar("child_id", { length: 36 }).references(() => children.id),
    relationship: varchar("relationship", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'approved', 'rejected'
    reviewed_by: varchar("reviewed_by", { length: 36 }),
    reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
    reject_reason: text("reject_reason"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("binding_parent_role_id_idx").on(table.parent_role_id),
    index("binding_status_idx").on(table.status),
    index("binding_created_at_idx").on(table.created_at),
  ]
);
