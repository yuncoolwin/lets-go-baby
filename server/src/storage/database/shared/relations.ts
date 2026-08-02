import { relations } from "drizzle-orm/relations";
import { classes, classMembers, userRoles, bindingRequests, children, users, parentChildRelations, growthRecords, attendanceRecords, dailyFeedbacks, attendance, families } from "./schema";

export const classMembersRelations = relations(classMembers, ({one}) => ({
	class: one(classes, {
		fields: [classMembers.classId],
		references: [classes.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	classMembers: many(classMembers),
	attendanceRecords: many(attendanceRecords),
}));

export const bindingRequestsRelations = relations(bindingRequests, ({one}) => ({
	userRole: one(userRoles, {
		fields: [bindingRequests.parentRoleId],
		references: [userRoles.id]
	}),
	child: one(children, {
		fields: [bindingRequests.childId],
		references: [children.id]
	}),
}));

export const userRolesRelations = relations(userRoles, ({one, many}) => ({
	bindingRequests: many(bindingRequests),
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
	parentChildRelations: many(parentChildRelations),
	growthRecords: many(growthRecords),
	dailyFeedbacks: many(dailyFeedbacks),
}));

export const childrenRelations = relations(children, ({one, many}) => ({
	bindingRequests: many(bindingRequests),
	parentChildRelations: many(parentChildRelations),
	growthRecords: many(growthRecords),
	attendanceRecords: many(attendanceRecords),
	dailyFeedbacks: many(dailyFeedbacks),
	attendances: many(attendance),
	family: one(families, {
		fields: [children.familyId],
		references: [families.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	userRoles: many(userRoles),
	parentChildRelations: many(parentChildRelations),
}));

export const parentChildRelationsRelations = relations(parentChildRelations, ({one}) => ({
	user: one(users, {
		fields: [parentChildRelations.userId],
		references: [users.id]
	}),
	userRole: one(userRoles, {
		fields: [parentChildRelations.parentRoleId],
		references: [userRoles.id]
	}),
	child: one(children, {
		fields: [parentChildRelations.childId],
		references: [children.id]
	}),
}));

export const growthRecordsRelations = relations(growthRecords, ({one}) => ({
	child: one(children, {
		fields: [growthRecords.childId],
		references: [children.id]
	}),
	userRole: one(userRoles, {
		fields: [growthRecords.teacherId],
		references: [userRoles.id]
	}),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({one}) => ({
	child: one(children, {
		fields: [attendanceRecords.childId],
		references: [children.id]
	}),
	class: one(classes, {
		fields: [attendanceRecords.classId],
		references: [classes.id]
	}),
}));

export const dailyFeedbacksRelations = relations(dailyFeedbacks, ({one}) => ({
	child: one(children, {
		fields: [dailyFeedbacks.childId],
		references: [children.id]
	}),
	userRole: one(userRoles, {
		fields: [dailyFeedbacks.teacherId],
		references: [userRoles.id]
	}),
}));

export const attendanceRelations = relations(attendance, ({one}) => ({
	child: one(children, {
		fields: [attendance.childId],
		references: [children.id]
	}),
}));

export const familiesRelations = relations(families, ({many}) => ({
	children: many(children),
}));