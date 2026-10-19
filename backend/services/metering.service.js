import prisma from "../config/prisma.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read plans configuration
const plansPath = path.resolve(__dirname, "../../nodejs-service/config/plans.json");
let plansConfig = {};
try {
  plansConfig = JSON.parse(fs.readFileSync(plansPath, "utf-8"));
} catch (e) {
  plansConfig = {
    free: { daily_ai_tutor: 5, budget_inr: "5" },
    basic: { daily_ai_tutor: 50, budget_inr: "50" },
    premium: { daily_ai_tutor: 200, budget_inr: "150" },
  };
}

/**
 * Resolves current user plan key ('free' | 'basic' | 'premium')
 */
export async function resolveUserPlanKey(userId) {
  if (!userId) return "free";
  
  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "active",
      currentEnd: { gte: new Date() },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!activeSub || !activeSub.plan) {
    return "free";
  }

  const key = (activeSub.plan.key || "").toLowerCase();
  if (key.includes("premium")) return "premium";
  if (key.includes("basic")) return "basic";
  return "free";
}

/**
 * Returns user's metering subscription or initializes a default free one
 */
export async function getOrCreateMeteringSubscription(userId) {
  const planKey = await resolveUserPlanKey(userId);
  const nowSec = Math.floor(Date.now() / 1000);
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  const sub = await prisma.meteringSubscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: planKey,
      period,
      starts: nowSec,
      ends: nowSec + 30 * 86400,
      active: true,
    },
    update: {},
  });

  // Ensure wallet exists
  const capMicro = Math.round(parseFloat(plansConfig[planKey]?.budget_inr || "5") * 1000000);
  await prisma.meteringWallet.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period, cap: capMicro },
    update: {},
  });

  // Synchronize if subscription upgraded/downgraded
  let currentSub = sub;
  if (sub.plan !== planKey) {
    currentSub = await prisma.meteringSubscription.update({
      where: { userId },
      data: { plan: planKey },
    });
  }

  return { sub: currentSub, planKey };
}

/**
 * Gets daily usage stats for a user (resets at midnight UTC)
 */
export async function getUserDailyAiUsage(userId) {
  const { planKey } = await getOrCreateMeteringSubscription(userId);
  const dailyLimit = plansConfig[planKey]?.daily_ai_tutor || 5;

  // Start of today in UTC
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const startSec = Math.floor(startOfToday.getTime() / 1000);

  // Count settled or pending requests created today for ai_tutor
  const todayCount = await prisma.meteringRequest.count({
    where: {
      userId,
      feature: "ai_tutor",
      createdAt: { gte: startSec },
      status: { in: ["settled", "pending", "reserved", "dispatched"] },
    },
  });

  // Calculate seconds until next reset (midnight UTC)
  const endOfToday = new Date(startOfToday);
  endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);
  const resetsInSeconds = Math.max(0, Math.floor((endOfToday.getTime() - Date.now()) / 1000));

  const remaining = Math.max(0, dailyLimit - todayCount);

  return {
    plan: planKey,
    dailyLimit,
    usedToday: todayCount,
    remainingToday: remaining,
    allowed: remaining > 0,
    resetsInSeconds,
    resetsAt: endOfToday.toISOString(),
  };
}

/**
 * Records AI token usage after Gemini completes
 */
export async function recordAiUsage({ userId, feature = "ai_tutor", prompt, responseText, promptTokens = 0, completionTokens = 0 }) {
  try {
    const { sub, planKey } = await getOrCreateMeteringSubscription(userId);
    const nowSec = Math.floor(Date.now() / 1000);
    const period = new Date().toISOString().slice(0, 7);
    const idem = `${userId}_${nowSec}_${Math.random().toString(36).substring(2, 9)}`;

    // Fallback token estimations if SDK didn't return usage metadata (approx 1 token = 4 chars)
    const inTokens = promptTokens > 0 ? promptTokens : Math.max(1, Math.ceil((prompt || "").length / 4));
    const outTokens = completionTokens > 0 ? completionTokens : Math.max(1, Math.ceil((responseText || "").length / 4));
    const totalTokens = inTokens + outTokens;

    // Gemini 2.5/3.8 Flash estimated cost: ~₹0.000015 per 1K input, ~₹0.00006 per 1K output (converted to micro-rupees)
    const costRupees = (inTokens * 0.000015 + outTokens * 0.00006);
    const costMicro = Math.max(1, Math.round(costRupees * 1000000));

    await prisma.meteringRequest.create({
      data: {
        userId,
        idem,
        payloadHash: "hash_" + idem,
        period,
        globalPeriod: period,
        feature,
        route: "economy",
        priceJson: JSON.stringify({ rate: "flash" }),
        reserved: costMicro,
        actual: costMicro,
        status: "settled",
        createdAt: nowSec,
        updatedAt: nowSec,
        usageJson: JSON.stringify({
          prompt_tokens: inTokens,
          completion_tokens: outTokens,
          total_tokens: totalTokens,
        }),
        usageTokensJson: JSON.stringify({
          inTokens,
          outTokens,
          totalTokens,
        }),
      },
    });

    // Update wallet spent
    await prisma.meteringWallet.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, spent: costMicro },
      update: { spent: { increment: costMicro } },
    });

    // Update feature usage
    await prisma.meteringFeatureUsage.upsert({
      where: { userId_period_feature: { userId, period, feature } },
      create: { userId, period, feature, used: 1 },
      update: { used: { increment: 1 } },
    });
  } catch (err) {
    console.error("[metering.service] Error recording usage:", err);
  }
}
