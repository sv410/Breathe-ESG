import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, emissionsRecordsTable, ingestionBatchesTable } from "@workspace/db";
import { GetDashboardSummaryQueryParams, GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const parsed = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clientId } = parsed.data;
  const where = clientId != null ? eq(emissionsRecordsTable.clientId, clientId) : undefined;
  const batchWhere = clientId != null ? eq(ingestionBatchesTable.clientId, clientId) : undefined;

  const [totals] = await db
    .select({
      totalRecords: sql<number>`count(*)::int`,
      pendingCount: sql<number>`count(*) filter (where status = 'pending')::int`,
      approvedCount: sql<number>`count(*) filter (where status = 'approved')::int`,
      rejectedCount: sql<number>`count(*) filter (where status = 'rejected')::int`,
      flaggedCount: sql<number>`count(*) filter (where status = 'flagged')::int`,
      suspiciousCount: sql<number>`count(*) filter (where is_suspicious = true)::int`,
      totalCo2eKg: sql<number>`coalesce(sum(normalized_co2e_kg), 0)::float`,
    })
    .from(emissionsRecordsTable)
    .where(where);

  const byScope = await db
    .select({
      scope: emissionsRecordsTable.scope,
      count: sql<number>`count(*)::int`,
      co2eKg: sql<number>`coalesce(sum(normalized_co2e_kg), 0)::float`,
    })
    .from(emissionsRecordsTable)
    .where(where)
    .groupBy(emissionsRecordsTable.scope);

  const bySource = await db
    .select({
      sourceType: emissionsRecordsTable.sourceType,
      count: sql<number>`count(*)::int`,
      co2eKg: sql<number>`coalesce(sum(normalized_co2e_kg), 0)::float`,
    })
    .from(emissionsRecordsTable)
    .where(where)
    .groupBy(emissionsRecordsTable.sourceType);

  const recentBatches = await db
    .select()
    .from(ingestionBatchesTable)
    .where(batchWhere)
    .orderBy(ingestionBatchesTable.createdAt)
    .limit(5);

  const serializeBatch = (b: typeof recentBatches[number]) => ({
    ...b,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    completedAt: b.completedAt instanceof Date ? b.completedAt.toISOString() : b.completedAt,
  });

  res.json(GetDashboardSummaryResponse.parse({
    totalRecords: totals?.totalRecords ?? 0,
    pendingCount: totals?.pendingCount ?? 0,
    approvedCount: totals?.approvedCount ?? 0,
    rejectedCount: totals?.rejectedCount ?? 0,
    flaggedCount: totals?.flaggedCount ?? 0,
    suspiciousCount: totals?.suspiciousCount ?? 0,
    totalCo2eKg: totals?.totalCo2eKg ?? 0,
    byScope,
    bySource: bySource.map(r => ({ sourceType: r.sourceType, count: r.count, co2eKg: r.co2eKg })),
    recentBatches: recentBatches.map(serializeBatch),
  }));
});

export default router;
