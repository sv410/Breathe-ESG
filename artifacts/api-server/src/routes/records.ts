import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, emissionsRecordsTable, auditLogsTable } from "@workspace/db";
import {
  ListRecordsQueryParams,
  ListRecordsResponse,
  GetRecordParams,
  GetRecordResponse,
  DeleteRecordParams,
  ReviewRecordParams,
  ReviewRecordBody,
  ReviewRecordResponse,
  GetRecordAuditLogParams,
  GetRecordAuditLogResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeRecord(r: Record<string, unknown>) {
  return {
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : r.reviewedAt,
    activityDate: r.activityDate instanceof Date ? (r.activityDate as Date).toISOString().split("T")[0] : r.activityDate,
  };
}

function serializeAuditLog(l: Record<string, unknown>) {
  return {
    ...l,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  };
}

router.get("/records", async (req, res): Promise<void> => {
  const parsed = ListRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clientId, batchId, status, scope, sourceType, isSuspicious, page, limit } = parsed.data;

  const conditions = [];
  if (clientId != null) conditions.push(eq(emissionsRecordsTable.clientId, clientId));
  if (batchId != null) conditions.push(eq(emissionsRecordsTable.batchId, batchId));
  if (status != null) conditions.push(eq(emissionsRecordsTable.status, status));
  if (scope != null) conditions.push(eq(emissionsRecordsTable.scope, scope));
  if (sourceType != null) conditions.push(eq(emissionsRecordsTable.sourceType, sourceType));
  if (isSuspicious != null) conditions.push(eq(emissionsRecordsTable.isSuspicious, isSuspicious));

  const resolvedPage = page ?? 1;
  const resolvedLimit = limit ?? 50;
  const offset = (resolvedPage - 1) * resolvedLimit;

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emissionsRecordsTable)
    .where(where);

  const records = await db
    .select()
    .from(emissionsRecordsTable)
    .where(where)
    .orderBy(emissionsRecordsTable.createdAt)
    .limit(resolvedLimit)
    .offset(offset);

  res.json(ListRecordsResponse.parse({
    data: records.map(r => serializeRecord(r as unknown as Record<string, unknown>)),
    total: countResult?.count ?? 0,
    page: resolvedPage,
    limit: resolvedLimit,
  }));
});

router.get("/records/:id", async (req, res): Promise<void> => {
  const params = GetRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(emissionsRecordsTable)
    .where(eq(emissionsRecordsTable.id, params.data.id));

  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  res.json(GetRecordResponse.parse(serializeRecord(record as unknown as Record<string, unknown>)));
});

router.delete("/records/:id", async (req, res): Promise<void> => {
  const params = DeleteRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(emissionsRecordsTable)
    .where(eq(emissionsRecordsTable.id, params.data.id));

  if (!record) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  await db.insert(auditLogsTable).values({
    recordId: params.data.id,
    action: "deleted",
    actor: "analyst",
    beforeState: record as unknown as Record<string, unknown>,
  });

  await db.delete(emissionsRecordsTable).where(eq(emissionsRecordsTable.id, params.data.id));

  res.sendStatus(204);
});

router.patch("/records/:id/review", async (req, res): Promise<void> => {
  const params = ReviewRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ReviewRecordBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(emissionsRecordsTable)
    .where(eq(emissionsRecordsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  const reviewedAt = new Date();
  const [updated] = await db
    .update(emissionsRecordsTable)
    .set({
      status: body.data.status,
      reviewNotes: body.data.reviewNotes ?? null,
      reviewedBy: body.data.reviewedBy ?? "analyst",
      reviewedAt,
    })
    .where(eq(emissionsRecordsTable.id, params.data.id))
    .returning();

  await db.insert(auditLogsTable).values({
    recordId: params.data.id,
    action: body.data.status,
    actor: body.data.reviewedBy ?? "analyst",
    beforeState: existing as unknown as Record<string, unknown>,
    afterState: updated as unknown as Record<string, unknown>,
  });

  res.json(ReviewRecordResponse.parse(serializeRecord(updated as unknown as Record<string, unknown>)));
});

router.get("/records/:id/audit", async (req, res): Promise<void> => {
  const params = GetRecordAuditLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db
    .select()
    .from(auditLogsTable)
    .where(eq(auditLogsTable.recordId, params.data.id))
    .orderBy(auditLogsTable.createdAt);

  res.json(GetRecordAuditLogResponse.parse(logs.map(l => serializeAuditLog(l as unknown as Record<string, unknown>))));
});

export default router;
