import { pgTable, text, serial, timestamp, integer, real, boolean, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { ingestionBatchesTable } from "./ingestion-batches";

export const emissionsRecordsTable = pgTable("emissions_records", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull().references(() => ingestionBatchesTable.id),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  scope: text("scope", { enum: ["scope1", "scope2", "scope3"] }).notNull(),
  category: text("category").notNull(),
  sourceType: text("source_type", { enum: ["sap", "utility", "travel"] }).notNull(),
  rawData: jsonb("raw_data").notNull().$type<Record<string, unknown>>(),
  activityAmount: real("activity_amount").notNull(),
  activityUnit: text("activity_unit").notNull(),
  normalizedCo2eKg: real("normalized_co2e_kg").notNull(),
  activityDate: date("activity_date").notNull(),
  location: text("location"),
  description: text("description"),
  status: text("status", { enum: ["pending", "approved", "rejected", "flagged"] }).notNull().default("pending"),
  reviewNotes: text("review_notes"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  isSuspicious: boolean("is_suspicious").notNull().default(false),
  suspiciousReason: text("suspicious_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEmissionsRecordSchema = createInsertSchema(emissionsRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmissionsRecord = z.infer<typeof insertEmissionsRecordSchema>;
export type EmissionsRecord = typeof emissionsRecordsTable.$inferSelect;
