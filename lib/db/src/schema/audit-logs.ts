import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { emissionsRecordsTable } from "./emissions-records";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull().references(() => emissionsRecordsTable.id),
  action: text("action", { enum: ["approved", "rejected", "flagged", "edited", "deleted"] }).notNull(),
  actor: text("actor").notNull(),
  beforeState: jsonb("before_state").$type<Record<string, unknown>>(),
  afterState: jsonb("after_state").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
