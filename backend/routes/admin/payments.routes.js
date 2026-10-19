import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import { adminGetPayments } from "../../controllers/admin-payment.controller.js";
import { validateQuery } from "../../middleware/validation.middleware.js";
import { z } from "zod";

const router = express.Router();

router.use(adminAuth);

router.get("/", validateQuery(z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
})), adminGetPayments);

export default router;
