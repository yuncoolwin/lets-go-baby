import { pgTable, index, foreignKey, varchar, timestamp, serial, text, unique, boolean, jsonb, integer, date, numeric, check, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const classMembers = pgTable("class_members", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	classId: varchar("class_id", { length: 36 }).notNull(),
	memberType: varchar("member_type", { length: 20 }).notNull(),
	memberId: varchar("member_id", { length: 36 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("class_members_class_id_idx").using("btree", table.classId.asc().nullsLast().op("text_ops")),
	index("class_members_member_idx").using("btree", table.memberType.asc().nullsLast().op("text_ops"), table.memberId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "class_members_class_id_classes_id_fk"
		}),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const bindingRequests = pgTable("binding_requests", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	parentRoleId: varchar("parent_role_id", { length: 36 }).notNull(),
	childName: varchar("child_name", { length: 64 }).notNull(),
	childId: varchar("child_id", { length: 36 }),
	relationship: varchar({ length: 20 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	reviewedBy: varchar("reviewed_by", { length: 36 }),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	rejectReason: text("reject_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	customRelationship: varchar("custom_relationship"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("binding_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("binding_parent_role_id_idx").using("btree", table.parentRoleId.asc().nullsLast().op("text_ops")),
	index("binding_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.parentRoleId],
			foreignColumns: [userRoles.id],
			name: "binding_requests_parent_role_id_user_roles_id_fk"
		}),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "binding_requests_child_id_children_id_fk"
		}),
]);

export const userRoles = pgTable("user_roles", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	roleType: varchar("role_type", { length: 20 }).notNull(),
	realName: varchar("real_name", { length: 64 }),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_roles_role_type_idx").using("btree", table.roleType.asc().nullsLast().op("text_ops")),
	index("user_roles_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	openid: varchar({ length: 128 }),
	unionid: varchar({ length: 128 }),
	nickname: varchar({ length: 128 }).default('').notNull(),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	phone: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_openid_idx").using("btree", table.openid.asc().nullsLast().op("text_ops")),
	unique("users_openid_unique").on(table.openid),
]);

export const parentChildRelations = pgTable("parent_child_relations", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	parentRoleId: varchar("parent_role_id", { length: 36 }).notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	relationship: varchar({ length: 20 }).notNull(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	customRelationship: varchar("custom_relationship", { length: 32 }),
	rejectReason: text("reject_reason"),
	approvedBy: varchar("approved_by", { length: 36 }),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("pcr_child_id_idx").using("btree", table.childId.asc().nullsLast().op("text_ops")),
	index("pcr_parent_role_id_idx").using("btree", table.parentRoleId.asc().nullsLast().op("text_ops")),
	index("pcr_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("pcr_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "parent_child_relations_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.parentRoleId],
			foreignColumns: [userRoles.id],
			name: "parent_child_relations_parent_role_id_user_roles_id_fk"
		}),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "parent_child_relations_child_id_children_id_fk"
		}),
]);

export const growthRecords = pgTable("growth_records", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	teacherId: varchar("teacher_id", { length: 36 }).notNull(),
	recordType: varchar("record_type", { length: 30 }).notNull(),
	title: varchar({ length: 128 }).notNull(),
	content: text(),
	photoUrls: jsonb("photo_urls"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("growth_child_id_idx").using("btree", table.childId.asc().nullsLast().op("text_ops")),
	index("growth_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("growth_teacher_id_idx").using("btree", table.teacherId.asc().nullsLast().op("text_ops")),
	index("growth_type_idx").using("btree", table.recordType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "growth_records_child_id_children_id_fk"
		}),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [userRoles.id],
			name: "growth_records_teacher_id_user_roles_id_fk"
		}),
]);

export const enrollments = pgTable("enrollments", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	courseType: varchar("course_type", { length: 50 }).default('').notNull(),
	durationType: varchar("duration_type", { length: 50 }).default('').notNull(),
	durationDays: integer("duration_days").default(0),
	startDate: date("start_date"),
	endDate: date("end_date"),
	status: varchar({ length: 20 }).default('进行中').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	paymentAmount: numeric("payment_amount", { precision: 10, scale:  2 }).default('0'),
	paymentChannel: varchar("payment_channel", { length: 20 }).default(''),
	classId: varchar("class_id", { length: 36 }),
}, (table) => [
	index("enrollments_child_id_idx").using("btree", table.childId.asc().nullsLast().op("text_ops")),
	index("enrollments_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "enrollments_child_id_children_id_fk"
		}).onDelete("cascade"),
]);

export const classes = pgTable("classes", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	description: text(),
	minAgeMonths: integer("min_age_months"),
	maxAgeMonths: integer("max_age_months"),
	status: varchar({ length: 20 }).default('active').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	level: varchar({ length: 20 }),
	capacity: integer().default(30),
	room: varchar({ length: 32 }),
}, (table) => [
	index("classes_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const attendanceRecords = pgTable("attendance_records", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	classId: varchar("class_id", { length: 36 }).notNull(),
	recordDate: date("record_date").notNull(),
	checkInTime: timestamp("check_in_time", { withTimezone: true, mode: 'string' }),
	checkOutTime: timestamp("check_out_time", { withTimezone: true, mode: 'string' }),
	checkInBy: varchar("check_in_by", { length: 36 }),
	checkOutBy: varchar("check_out_by", { length: 36 }),
	status: varchar({ length: 20 }).default('present').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("attendance_child_id_idx").using("btree", table.childId.asc().nullsLast().op("text_ops")),
	index("attendance_class_id_idx").using("btree", table.classId.asc().nullsLast().op("text_ops")),
	index("attendance_date_idx").using("btree", table.recordDate.asc().nullsLast().op("date_ops")),
	index("attendance_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "attendance_records_child_id_children_id_fk"
		}),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "attendance_records_class_id_classes_id_fk"
		}),
]);

export const dailyFeedbacks = pgTable("daily_feedbacks", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	teacherId: varchar("teacher_id", { length: 36 }).notNull(),
	feedbackDate: date("feedback_date").notNull(),
	mealStatus: varchar("meal_status", { length: 50 }),
	sleepStatus: varchar("sleep_status", { length: 50 }),
	moodStatus: varchar("mood_status", { length: 50 }),
	activities: text(),
	notes: text(),
	photoUrls: jsonb("photo_urls"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feedbacks_child_id_idx").using("btree", table.childId.asc().nullsLast().op("text_ops")),
	index("feedbacks_date_idx").using("btree", table.feedbackDate.asc().nullsLast().op("date_ops")),
	index("feedbacks_teacher_id_idx").using("btree", table.teacherId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "daily_feedbacks_child_id_children_id_fk"
		}),
	foreignKey({
			columns: [table.teacherId],
			foreignColumns: [userRoles.id],
			name: "daily_feedbacks_teacher_id_user_roles_id_fk"
		}),
	unique("daily_feedbacks_child_date_unique").on(table.childId, table.feedbackDate),
]);

export const families = pgTable("families", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	childId: varchar("child_id", { length: 36 }).notNull(),
	teacherId: varchar("teacher_id", { length: 36 }).notNull(),
	classId: varchar("class_id", { length: 36 }).notNull(),
	date: date().notNull(),
	status: varchar({ length: 10 }).default('unknown').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	updatedAt: timestamp("updated_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
	index("idx_attendance_class_date").using("btree", table.classId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("text_ops")),
	index("idx_attendance_date").using("btree", table.date.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.childId],
			foreignColumns: [children.id],
			name: "fk_attendance_child"
		}).onDelete("cascade"),
	unique("attendance_child_id_date_key").on(table.childId, table.date),
]);

export const children = pgTable("children", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	gender: varchar({ length: 10 }).default('unknown').notNull(),
	birthDate: date("birth_date"),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	familyId: varchar("family_id", { length: 36 }),
	classId: varchar("class_id", { length: 36 }),
	healthInfo: text("health_info"),
	allergies: text(),
	status: varchar({ length: 20 }).default('active'),
	courseType: varchar("course_type", { length: 20 }).default(''),
	enrollmentDuration: varchar("enrollment_duration", { length: 50 }).default(''),
	startDate: date("start_date"),
	endDate: date("end_date"),
	customDays: varchar("custom_days", { length: 20 }).default(''),
	paymentAmount: numeric("payment_amount", { precision: 10, scale:  2 }).default('0'),
	paymentChannel: varchar("payment_channel", { length: 20 }).default(''),
}, (table) => [
	index("children_family_id_idx").using("btree", table.familyId.asc().nullsLast().op("text_ops")),
	index("children_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.familyId],
			foreignColumns: [families.id],
			name: "children_family_id_families_id_fk"
		}),
]);

export const teachers = pgTable("teachers", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	realName: varchar("real_name", { length: 50 }).notNull(),
	phone: varchar({ length: 20 }),
	qualification: varchar({ length: 100 }),
	specialty: varchar({ length: 100 }),
	status: varchar({ length: 20 }).default('active'),
	userId: varchar("user_id", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	classId: varchar("class_id"),
	nickname: varchar(),
	entryDate: varchar("entry_date"),
	leaveDate: varchar("leave_date"),
	title: varchar({ length: 64 }),
});

export const notifications = pgTable("notifications", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	title: varchar({ length: 128 }).notNull(),
	content: text().notNull(),
	type: varchar({ length: 30 }).notNull(),
	senderId: varchar("sender_id", { length: 36 }),
	targetType: varchar("target_type", { length: 20 }).default('all').notNull(),
	targetId: varchar("target_id", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	scope: varchar({ length: 20 }).default('all'),
	targetIds: text("target_ids"),
	isPinned: boolean("is_pinned").default(false),
	authorId: varchar("author_id", { length: 36 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("notifications_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("notifications_target_idx").using("btree", table.targetType.asc().nullsLast().op("text_ops"), table.targetId.asc().nullsLast().op("text_ops")),
	index("notifications_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const notificationReads = pgTable("notification_reads", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	notificationId: varchar("notification_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const holidays = pgTable("holidays", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	date: date().notNull(),
	type: varchar({ length: 20 }).notNull(),
	name: varchar({ length: 100 }).default(''),
	year: integer().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("holidays_date_key").on(table.date),
	check("holidays_type_check", sql`(type)::text = ANY ((ARRAY['holiday'::character varying, 'work_weekend'::character varying])::text[])`),
]);

export const auditLogs = pgTable("audit_logs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }),
	userRoleId: varchar("user_role_id", { length: 36 }),
	action: varchar({ length: 50 }).notNull(),
	targetType: varchar("target_type", { length: 50 }),
	targetId: varchar("target_id", { length: 36 }),
	detail: jsonb(),
	level: varchar({ length: 20 }).default('info'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("audit_logs_user_id_idx").on(table.userId),
	index("audit_logs_user_role_id_idx").on(table.userRoleId),
	index("audit_logs_created_at_idx").on(table.createdAt),
	index("audit_logs_action_idx").on(table.action),
	index("audit_logs_target_type_idx").on(table.targetType),
]);
