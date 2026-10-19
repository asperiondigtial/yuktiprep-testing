import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import {
  adminGetPlans,
  adminGetPlanById,
  adminCreatePlan,
  adminUpdatePlan,
  adminPatchPlanStatus,
  adminReorderPlans,
  adminDeletePlan,
} from "../../controllers/admin-plan.controller.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validation.middleware.js";
import { z } from "zod";
import { planSchema, planQuerySchema, reorderPlansSchema } from "../../validators/plan.validator.js";

const router = express.Router();

router.use(adminAuth);

router.get("/", validateQuery(planQuerySchema), adminGetPlans);
router.get("/:id", validateParams(z.object({ id: z.string().uuid() })), adminGetPlanById);
router.post("/", validateBody(planSchema), adminCreatePlan);
router.put("/:id", validateParams(z.object({ id: z.string().uuid() })), validateBody(planSchema.partial()), adminUpdatePlan);
router.patch("/:id", validateParams(z.object({ id: z.string().uuid() })), validateBody(planSchema.partial()), adminUpdatePlan);
router.patch("/:id/status", validateParams(z.object({ id: z.string().uuid() })), validateBody(z.object({ isActive: z.boolean() })), adminPatchPlanStatus);
router.patch("/reorder", validateBody(reorderPlansSchema), adminReorderPlans);
router.delete("/:id", validateParams(z.object({ id: z.string().uuid() })), adminDeletePlan);

export default router;

