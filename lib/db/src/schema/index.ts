import {
  pgTable,
  text,
  boolean,
  numeric,
  timestamp,
  pgEnum,
  uuid,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { relations } from "drizzle-orm";

// ── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum        = pgEnum("role",         ["ADMIN", "STAFF", "SUPERADMIN"]);
export const photoFormatEnum = pgEnum("photo_format", ["SOFTCOPY", "HARDCOPY", "BOTH"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PAID"]);
export const orderStatusEnum = pgEnum("order_status", ["PENDING", "EDITING", "READY", "DELIVERED"]);
export const planEnum        = pgEnum("plan",         ["free", "pro"]);

// ── Studios ─────────────────────────────────────────────────────────────────

export const subscriptionStatusEnum = pgEnum("subscription_status", ["active", "trial", "expired"]);

export const studiosTable = pgTable("studios", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  name:               text("name").notNull(),
  slug:               text("slug").notNull().unique(),
  logoUrl:            text("logo_url"),
  phone:              text("phone"),
  address:            text("address"),
  email:              text("email"),
  plan:               planEnum("plan").notNull().default("free"),
  isActive:           boolean("is_active").notNull().default(true),
  subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("active"),
  trialEndsAt:        timestamp("trial_ends_at"),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
  updatedAt:          timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const studiosRelations = relations(studiosTable, ({ many }) => ({
  users:   many(usersTable),
  clients: many(clientsTable),
}));

export type Studio = typeof studiosTable.$inferSelect;

// ── Users ───────────────────────────────────────────────────────────────────

export const usersTable = pgTable("users", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  // email is unique per-studio (composite index below). Globally allow duplicates
  // so the same person can belong to multiple studios. SUPERADMIN has studioId = null.
  email:     text("email").notNull(),
  phone:     text("phone").notNull(),
  password:  text("password").notNull(),
  role:      roleEnum("role").notNull().default("STAFF"),
  isActive:  boolean("is_active").notNull().default(true),
  // null only for SUPERADMIN accounts
  studioId:  uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  // email must be unique within a studio; globally a person may have accounts in multiple studios
  uniqueIndex("users_email_studio_idx").on(t.email, t.studioId),
]);

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  studio:        one(studiosTable, { fields: [usersTable.studioId], references: [studiosTable.id] }),
  passwordReset: one(passwordResetSessionsTable, { fields: [usersTable.id], references: [passwordResetSessionsTable.userId] }),
  clients:   many(clientsTable),
  galleries: many(galleriesTable),
  invoices:  many(invoicesTable),
  payments:  many(paymentsTable),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

// ── Password Reset Sessions ─────────────────────────────────────────────────

export const passwordResetSessionsTable = pgTable("password_reset_sessions", {
  userId:              uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  otpHash:             text("otp_hash"),
  otpExpiresAt:        timestamp("otp_expires_at"),
  attemptCount:        integer("attempt_count").notNull().default(0),
  lastSentAt:          timestamp("last_sent_at").notNull().defaultNow(),
  verifiedAt:          timestamp("verified_at"),
  resetTokenHash:      text("reset_token_hash"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  consumedAt:          timestamp("consumed_at"),
});

export const passwordResetSessionsRelations = relations(passwordResetSessionsTable, ({ one }) => ({
  user: one(usersTable, { fields: [passwordResetSessionsTable.userId], references: [usersTable.id] }),
}));

// ── Clients ─────────────────────────────────────────────────────────────────

export const clientsTable = pgTable("clients", {
  id:            uuid("id").primaryKey().defaultRandom(),
  clientName:    text("client_name").notNull(),
  phone:         text("phone").notNull(),
  price:         numeric("price",   { precision: 10, scale: 2 }).notNull(),
  deposit:       numeric("deposit", { precision: 10, scale: 2 }).notNull().default("0"),
  photoFormat:   photoFormatEnum("photo_format").notNull().default("SOFTCOPY"),
  orderStatus:   orderStatusEnum("order_status").notNull().default("PENDING"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  notes:         text("notes"),
  // gallery_token remains globally unique — used in public gallery URLs
  galleryToken:  text("gallery_token").notNull().unique(),
  studioId:      uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  createdById:   uuid("created_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const clientsRelations = relations(clientsTable, ({ one, many }) => ({
  studio:    one(studiosTable, { fields: [clientsTable.studioId], references: [studiosTable.id] }),
  createdBy: one(usersTable,   { fields: [clientsTable.createdById], references: [usersTable.id] }),
  gallery:   one(galleriesTable, { fields: [clientsTable.id], references: [galleriesTable.clientId] }),
  photos:    many(photosTable),
  invoices:  many(invoicesTable),
  payments:  many(paymentsTable),
}));

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

// ── Galleries ───────────────────────────────────────────────────────────────

export const galleriesTable = pgTable("galleries", {
  id:           uuid("id").primaryKey().defaultRandom(),
  token:        text("token").notNull().unique(),
  clientId:     uuid("client_id").notNull().unique().references(() => clientsTable.id, { onDelete: "cascade" }),
  uploadedById: uuid("uploaded_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  studioId:     uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const galleriesRelations = relations(galleriesTable, ({ one, many }) => ({
  studio:     one(studiosTable, { fields: [galleriesTable.studioId], references: [studiosTable.id] }),
  client:     one(clientsTable, { fields: [galleriesTable.clientId], references: [clientsTable.id] }),
  uploadedBy: one(usersTable,   { fields: [galleriesTable.uploadedById], references: [usersTable.id] }),
  photos:     many(photosTable),
}));

// ── Photos ──────────────────────────────────────────────────────────────────

export const photosTable = pgTable("photos", {
  id:        uuid("id").primaryKey().defaultRandom(),
  fileName:  text("file_name").notNull(),
  imageUrl:  text("image_url").notNull(),
  publicId:  text("public_id"),
  clientId:  uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  galleryId: uuid("gallery_id").notNull().references(() => galleriesTable.id, { onDelete: "cascade" }),
  studioId:  uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const photosRelations = relations(photosTable, ({ one }) => ({
  studio:  one(studiosTable,  { fields: [photosTable.studioId],  references: [studiosTable.id] }),
  client:  one(clientsTable,  { fields: [photosTable.clientId],  references: [clientsTable.id] }),
  gallery: one(galleriesTable,{ fields: [photosTable.galleryId], references: [galleriesTable.id] }),
}));

// ── Invoices ────────────────────────────────────────────────────────────────

export const invoicesTable = pgTable("invoices", {
  id:            uuid("id").primaryKey().defaultRandom(),
  // invoice_number is unique per studio (e.g. INV-0001 per studio, not globally)
  invoiceNumber: text("invoice_number").notNull(),
  amount:        numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
  studioId:      uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  clientId:      uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  createdById:   uuid("created_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("invoices_number_studio_idx").on(t.invoiceNumber, t.studioId),
]);

export const invoicesRelations = relations(invoicesTable, ({ one }) => ({
  studio:    one(studiosTable, { fields: [invoicesTable.studioId],    references: [studiosTable.id] }),
  client:    one(clientsTable, { fields: [invoicesTable.clientId],    references: [clientsTable.id] }),
  createdBy: one(usersTable,   { fields: [invoicesTable.createdById], references: [usersTable.id] }),
}));

// ── Payments ────────────────────────────────────────────────────────────────

export const paymentsTable = pgTable("payments", {
  id:           uuid("id").primaryKey().defaultRandom(),
  amount:       numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status:       paymentStatusEnum("status").notNull().default("PAID"),
  studioId:     uuid("studio_id").references(() => studiosTable.id, { onDelete: "cascade" }),
  clientId:     uuid("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  receivedById: uuid("received_by_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
});

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  studio:     one(studiosTable, { fields: [paymentsTable.studioId],     references: [studiosTable.id] }),
  client:     one(clientsTable, { fields: [paymentsTable.clientId],     references: [clientsTable.id] }),
  receivedBy: one(usersTable,   { fields: [paymentsTable.receivedById], references: [usersTable.id] }),
}));

// ── Upgrade Requests ─────────────────────────────────────────────────────────

export const upgradeRequestStatusEnum = pgEnum("upgrade_request_status", ["pending", "confirmed", "rejected"]);

export const upgradeRequestsTable = pgTable("upgrade_requests", {
  id:        uuid("id").primaryKey().defaultRandom(),
  studioId:  uuid("studio_id").notNull().references(() => studiosTable.id, { onDelete: "cascade" }),
  amount:    numeric("amount", { precision: 10, scale: 2 }).notNull(),
  reference: text("reference").notNull(),
  notes:     text("notes"),
  status:    upgradeRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const upgradeRequestsRelations = relations(upgradeRequestsTable, ({ one }) => ({
  studio: one(studiosTable, { fields: [upgradeRequestsTable.studioId], references: [studiosTable.id] }),
}));

export type UpgradeRequest = typeof upgradeRequestsTable.$inferSelect;

// ── Platform Settings ─────────────────────────────────────────────────────────

export const platformSettingsTable = pgTable("platform_settings", {
  id:            uuid("id").primaryKey().defaultRandom(),
  bankName:      text("bank_name").notNull().default(""),
  accountNumber: text("account_number").notNull().default(""),
  accountName:   text("account_name").notNull().default(""),
  proPlanPrice:  numeric("pro_plan_price", { precision: 10, scale: 2 }).notNull().default("50000"),
  updatedAt:     timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PlatformSettings = typeof platformSettingsTable.$inferSelect;

// ── Activity Logs ────────────────────────────────────────────────────────────

export const activityLogsTable = pgTable("activity_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  studioId:   uuid("studio_id").notNull().references(() => studiosTable.id, { onDelete: "cascade" }),
  userId:     uuid("user_id").notNull(),
  userName:   text("user_name").notNull(),
  userRole:   text("user_role").notNull().default("staff"),
  action:     text("action").notNull(),
  entityType: text("entity_type"),
  entityId:   text("entity_id"),
  entityName: text("entity_name"),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const activityLogsRelations = relations(activityLogsTable, ({ one }) => ({
  studio: one(studiosTable, { fields: [activityLogsTable.studioId], references: [studiosTable.id] }),
}));

export type ActivityLog = typeof activityLogsTable.$inferSelect;
