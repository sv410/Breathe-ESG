import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const ingestionBatchesTable = pgTable("ingestion_batches", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  sourceType: text("source_type", { enum: ["sap", "utility", "travel"] }).notNull(),
  status: text("status", { enum: ["processing", "completed", "failed"] }).notNull().default("processing"),
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorDetails: text("error_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertIngestionBatchSchema = createInsertSchema(ingestionBatchesTable).omit({ id: true, createdAt: true });
export type InsertIngestionBatch = z.infer<typeof insertIngestionBatchSchema>;
export type IngestionBatch = typeof ingestionBatchesTable.$inferSelect;
