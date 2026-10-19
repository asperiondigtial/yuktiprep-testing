import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import {
  evaluateAnswer,
  brainstormTopic,
  saveAttempt,
  getAttempts,
  getAnalytics,
} from "../controllers/mains360.controller.js";

const router = express.Router();

// Optional auth for evaluate / brainstorm / analytics
// Attaches req.user if a valid token is present, otherwise proceeds cleanly
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      if (decoded?.id) {
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (user) req.user = user;
      }
    }
  } catch (err) {
    // Graceful fallback for guest/expired token
    req.user = null;
  }
  next();
};

router.post("/evaluate", optionalAuth, evaluateAnswer);
router.post("/brainstorm", optionalAuth, brainstormTopic);
router.post("/attempts", optionalAuth, saveAttempt);
router.get("/attempts", optionalAuth, getAttempts);
router.get("/analytics", optionalAuth, getAnalytics);

export default router;
