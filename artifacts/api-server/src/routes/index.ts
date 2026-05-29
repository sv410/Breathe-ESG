import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import batchesRouter from "./batches";
import recordsRouter from "./records";
import dashboardRouter from "./dashboard";
import ingestRouter from "./ingest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(batchesRouter);
router.use(recordsRouter);
router.use(dashboardRouter);
router.use(ingestRouter);

export default router;
