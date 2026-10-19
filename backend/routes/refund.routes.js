import express from "express";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  checkRefundEligibility,
  requestRefund,
  getMyRefundRequests,
  adminGetRefundRequests,
  adminProcessRefund,
  adminDirectRefund,
} from "../controllers/refund.controller.js";

const router = express.Router();

// User endpoints
router.get("/eligibility", userAuthMiddleware, checkRefundEligibility);
router.post("/request", userAuthMiddleware, requestRefund);
router.get("/my-refunds", userAuthMiddleware, getMyRefundRequests);

// Admin endpoints
router.get("/admin", adminAuth, adminGetRefundRequests);
router.patch("/admin/:id/process", adminAuth, adminProcessRefund);
router.post("/admin/direct-refund", adminAuth, adminDirectRefund);

export default router;
