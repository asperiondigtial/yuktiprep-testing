import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cron from "node-cron";
import http from "http";

import prisma from "./config/prisma.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  otpLimiter,
} from "./middleware/rateLimiter.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminSettingsRoutes from "./routes/admin/settings.routes.js";
import adminUsersRoutes from "./routes/admin/users.routes.js";
import adminQuestionIntelligenceRoutes from "./routes/admin/questionIntelligence.routes.js";
import adminWhatsAppRoutes from "./routes/admin/whatsapp.routes.js";
import adminPlansRoutes from "./routes/admin/plans.routes.js";
import adminSubscriptionsRoutes from "./routes/admin/subscriptions.routes.js";
import adminPaymentsRoutes from "./routes/admin/payments.routes.js";
import adminAiMeteringRoutes from "./routes/admin/aiMetering.routes.js";
import adminCompetitiveExamsRoutes from "./routes/admin/competitiveExams.routes.js";
import adminExamCategoriesRoutes from "./routes/admin/examCategories.routes.js";
import adminLanguagesRoutes from "./routes/admin/languages.routes.js";

import publicRoutes from "./routes/public.routes.js";
import currentAffairsRoutes from "./routes/current-affairs.routes.js";
import jobsRoutes from "./routes/jobs.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import languageRoutes from "./routes/language.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import planRoutes from "./routes/plans.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import publishedQuestionsRoutes from "./routes/publishedQuestions.routes.js";
import competitiveExamsRoutes from "./routes/competitiveExams.routes.js";
import studyPlanRoutes from "./routes/studyPlan.routes.js";
import testRoutes from "./routes/test.routes.js";
import communityRoutes from "./routes/community.routes.js";
import supportRoutes from "./routes/support.routes.js";
import examSelectionRoutes from "./routes/examSelection.routes.js";
import interviewRoutes from "./routes/interview.routes.js";
import mains360Routes from "./routes/mains360.routes.js";
import refundRoutes from "./routes/refund.routes.js";

import webhooksRoutes from "./routes/webhooks.routes.js";
import webhooksWhatsAppEventsRoutes from "./routes/webhooks/whatsapp-events.routes.js";
import webhooksWhatsAppMetaRoutes from "./routes/webhooks/whatsapp.routes.js";
import runtimeConversationRoutes from "./routes/runtime/conversation.routes.js";

import { fetchJobs } from "./services/jobs.service.js";
import { initializeCronJobs } from "./cron.js";
import { initializeSocket } from "./socket.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(morgan("dev"));

const allowedOrigins = [
  env.FRONTEND_URL,
  env.ADMIN_FRONTEND_URL,
  env.APP_FRONTEND_URL,
  "http://localhost:5001",
  "http://localhost:3000",
];

const corsOptions = {
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, Capacitor native requests)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in dev/staging to prevent WebView origin drops
  },
  credentials: true,
};

// 1. CORS & Security first (Handles OPTIONS preflight immediately)
app.use(cors(corsOptions));
app.use(helmet());

// 2. Body & cookie parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// 3. Webhooks & runtime routes
app.use("/api/v1/webhooks", webhooksRoutes);
app.use("/api/webhooks/razorpay", webhooksRoutes);
app.use("/api/webhooks", webhooksWhatsAppEventsRoutes);
app.use("/webhooks", webhooksWhatsAppMetaRoutes);
app.use("/v1", runtimeConversationRoutes);

// 4. Rate limiting for general API routes
app.use(generalLimiter);

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.originalUrl);
  next();
});

// 5. Application routes
app.use("/api/v1/auth", authLimiter, authRoutes);
app.use("/api/v1/admin/whatsapp", adminWhatsAppRoutes);
app.use("/api/v1/admin/intelligence", adminQuestionIntelligenceRoutes);
app.use("/api/v1/questions", publishedQuestionsRoutes);
app.use("/api/v1/admin/users", adminUsersRoutes);
app.use("/api/v1/admin/settings", adminSettingsRoutes);
app.use("/api/v1/admin/plans", adminPlansRoutes);
app.use("/api/v1/admin/subscriptions", adminSubscriptionsRoutes);
app.use("/api/v1/admin/payments", adminPaymentsRoutes);
app.use("/api/v1/admin/ai-metering", adminAiMeteringRoutes);
app.use("/api/v1/admin/competitive-exams", adminCompetitiveExamsRoutes);
app.use("/api/v1/admin/languages", adminLanguagesRoutes);
app.use("/api/v1/admin", adminExamCategoriesRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use("/api/v1/public", publicRoutes);
app.use("/api/v1/jobs", jobsRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/languages", languageRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/current-affairs", currentAffairsRoutes);
app.use("/api/v1/plans", planRoutes);
app.use("/api/v1/subscriptions", paymentLimiter, subscriptionRoutes);
app.use("/api/v1/competitive-exams", competitiveExamsRoutes);
app.use("/api/v1/study-planner", studyPlanRoutes);
app.use("/api/v1/tests", testRoutes);
app.use("/api/v1/community", communityRoutes);
app.use("/api/v1/interview", interviewRoutes);
app.use("/api/v1/interviews", interviewRoutes);
app.use("/api/v1/mains-360", mains360Routes);
app.use("/api/essay-practice", mains360Routes);
app.use("/api/v1", examSelectionRoutes);
app.use("/api/v1/support", supportRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/v1/refunds", refundRoutes);

app.get("/", async (req, res, next) => {
  try {
    return res.json({ message: "Yuktiprep Backend server is running" });
  } catch (error) {
    return next(error);
  }
});

app.use(errorHandler);

// Schedule daily jobs sync at 6:00 AM
cron.schedule("0 6 * * *", async () => {
  console.log("Running daily AI jobs sync at 6:00 AM...");
  try {
    const filters = {
      query: "Latest Govt Jobs",
      state: "All India",
      category: "All Categories",
      qualification: "Any",
      jobType: "All Types",
    };
    const res = await fetchJobs(filters, "", true);
    console.log(`Successfully synced ${res.jobs?.length || 0} jobs from AI.`);
  } catch (err) {
    console.error("Daily jobs sync failed:", err);
  }
});

initializeCronJobs();

const httpServer = http.createServer(app);
initializeSocket(httpServer);

httpServer.listen(env.PORT, "0.0.0.0", () => {
  console.log(
    `Server is running on http://localhost:${env.PORT} with Socket.IO enabled`,
  );
});
