import prisma from "../config/prisma.js";
import { getUserDailyAiUsage } from "../services/metering.service.js";

/**
 * Controller for Admin AI Token & Usage Metering Tracking
 */

/**
 * GET /api/v1/admin/ai-metering/analytics
 * Platform-wide AI token consumption, total requests, cost, and active consumers
 */
export async function getAiMeteringAnalytics(req, res) {
  try {
    const totalRequests = await prisma.meteringRequest.count();

    // Sum of tokens and costs from settled requests
    const settledRequests = await prisma.meteringRequest.findMany({
      where: { status: "settled" },
      select: {
        actual: true,
        usageJson: true,
        feature: true,
        createdAt: true,
      },
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostMicro = 0;
    const featureBreakdown = { ai_tutor: 0, study_plan: 0, other: 0 };

    for (const r of settledRequests) {
      totalCostMicro += r.actual || 0;
      if (r.feature === "ai_tutor") featureBreakdown.ai_tutor++;
      else if (r.feature === "study_plan") featureBreakdown.study_plan++;
      else featureBreakdown.other++;

      if (r.usageJson) {
        try {
          const u = JSON.parse(r.usageJson);
          totalPromptTokens += u.prompt_tokens || 0;
          totalCompletionTokens += u.completion_tokens || 0;
          totalTokens += u.total_tokens || ((u.prompt_tokens || 0) + (u.completion_tokens || 0));
        } catch (e) {}
      }
    }

    // Cost in INR: 1,000,000 micro = 1 INR
    const totalCostRupees = Number((totalCostMicro / 1000000).toFixed(4));

    // Active subscriptions breakdown
    const subCounts = await prisma.meteringSubscription.groupBy({
      by: ["plan"],
      _count: { userId: true },
    });

    const planBreakdown = { free: 0, basic: 0, premium: 0 };
    for (const s of subCounts) {
      if (s.plan in planBreakdown) planBreakdown[s.plan] = s._count.userId;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalRequests,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCostRupees,
        featureBreakdown,
        planBreakdown,
      },
    });
  } catch (error) {
    console.error("Error in getAiMeteringAnalytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch AI metering analytics.",
    });
  }
}

/**
 * GET /api/v1/admin/ai-metering/users/:userId
 * Retrieves detailed token consumption, daily quota and logs for a specific user
 */
export async function getUserAiMeteringDetails(req, res) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phoneNumber: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const quota = await getUserDailyAiUsage(userId);

    // Fetch user's metering requests (latest 50)
    const requests = await prisma.meteringRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalCostMicro = 0;

    const requestLogs = requests.map((r) => {
      let promptTokens = 0;
      let completionTokens = 0;
      let total = 0;
      if (r.usageJson) {
        try {
          const u = JSON.parse(r.usageJson);
          promptTokens = u.prompt_tokens || 0;
          completionTokens = u.completion_tokens || 0;
          total = u.total_tokens || (promptTokens + completionTokens);
        } catch (e) {}
      }

      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;
      totalTokens += total;
      totalCostMicro += r.actual || 0;

      return {
        id: r.id,
        feature: r.feature,
        status: r.status,
        promptTokens,
        completionTokens,
        totalTokens: total,
        costRupees: Number(((r.actual || 0) / 1000000).toFixed(4)),
        createdAt: new Date(r.createdAt * 1000).toISOString(),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        user,
        quota,
        totals: {
          totalRequests: requests.length,
          totalPromptTokens,
          totalCompletionTokens,
          totalTokens,
          totalCostRupees: Number((totalCostMicro / 1000000).toFixed(4)),
        },
        logs: requestLogs,
      },
    });
  } catch (error) {
    console.error("Error in getUserAiMeteringDetails:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user AI metering details.",
    });
  }
}
