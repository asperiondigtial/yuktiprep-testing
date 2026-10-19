import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import {
  adminGetSubscriptions,
  adminRevokeSubscription,
  adminGrantPremiumTrial,
  adminDowngradeToFree,
} from "../../controllers/admin-subscription.controller.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validation.middleware.js";
import { z } from "zod";

const router = express.Router();

router.use(adminAuth);

router.get("/", validateQuery(z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
})), adminGetSubscriptions);

router.post("/:id/revoke", validateParams(z.object({ id: z.string().uuid() })), adminRevokeSubscription);

router.post("/grant-trial", validateBody(z.object({
  userId: z.string().uuid(),
  days: z.number().optional().default(7),
})), adminGrantPremiumTrial);

router.post("/downgrade-free", validateBody(z.object({
  userId: z.string().uuid(),
})), adminDowngradeToFree);

export default router;

