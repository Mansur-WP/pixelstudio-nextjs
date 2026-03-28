import { Router, type IRouter } from "express";
import healthRouter   from "./health";
import authRouter     from "./auth";
import clientsRouter  from "./clients";
import photosRouter   from "./photos";
import galleryRouter  from "./gallery";
import invoicesRouter from "./invoices";
import paymentsRouter from "./payments";
import staffRouter    from "./staff";
import dashboardRouter from "./dashboard";
import studiosRouter  from "./studios";
import platformRouter from "./platform";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",      authRouter);
router.use("/studios",   studiosRouter);
router.use("/platform",  platformRouter);
router.use("/clients",   clientsRouter);
router.use("/clients",   photosRouter);
router.use("/photos",    photosRouter);
router.use("/gallery",   galleryRouter);
router.use("/invoices",  invoicesRouter);
router.use("/payments",  paymentsRouter);
router.use("/staff",     staffRouter);
router.use("/dashboard", dashboardRouter);
router.use("/activity",  activityRouter);

export default router;
