import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ingestionBatchesTable } from "@workspace/db";
import {
  ListBatchesQueryParams,
  ListBatchesResponse,
  GetBatchParams,
  GetBatchResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeBatch(b: Record<string, unknown>) {
  return {
    ...b,
    createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
    completedAt: b.completedAt instanceof Date ? b.completedAt.toISOString() : b.completedAt,
  };
}

router.get("/batches", async (req, res): Promise<void> => {
  const parsed = ListBatchesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clientId, sourceType, status } = parsed.data;
  const conditions = [];

  if (clientId != null) conditions.push(eq(ingestionBatchesTable.clientId, clientId));
  if (sourceType != null) conditions.push(eq(ingestionBatchesTable.sourceType, sourceType));
  if (status != null) conditions.push(eq(ingestionBatchesTable.status, status));

  const batches = await db
    .select()
    .from(ingestionBatchesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ingestionBatchesTable.createdAt);

  res.json(ListBatchesResponse.parse(batches.map(serializeBatch)));
});

router.get("/batches/:id", async (req, res): Promise<void> => {
  const params = GetBatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [batch] = await db
    .select()
    .from(ingestionBatchesTable)
    .where(eq(ingestionBatchesTable.id, params.data.id));

  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  res.json(GetBatchResponse.parse(serializeBatch(batch as unknown as Record<string, unknown>)));
});

export default router;
