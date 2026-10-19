import express from "express";
import { userAuthMiddleware } from "../middleware/userAuth.middleware.js";
import { getWelcomeData } from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/welcome", userAuthMiddleware, getWelcomeData);

export default router;
