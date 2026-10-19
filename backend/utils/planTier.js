export const PLAN_TIERS = {
  FREE: 0,
  BASIC: 1,
  PREMIUM: 2,
};

export const FREE_PLAN_ID = "4353a25d-afc2-4830-a5b9-fbaf7408a62e";
export const BASIC_PLAN_ID = "6da26b45-b93c-470e-907b-8c330215dce6";
export const PREMIUM_PLAN_ID = "fecdfd98-db58-4d6e-ac79-8dbb1e153a9f";

/**
 * Returns the numeric plan tier for a user.
 * 0 = Free (or expired/guest)
 * 1 = Basic (or active standard/basic)
 * 2 = Premium
 */
export async function getUserPlanTier(userId, prisma) {
  if (!userId) {
    return {
      tier: PLAN_TIERS.FREE,
      tierName: "FREE",
      planId: null,
      isSubscriber: false,
    };
  }

  try {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        status: { in: ["active", "trialing", "paid"] },
        OR: [{ currentEnd: null }, { currentEnd: { gte: new Date() } }],
      },
      select: {
        id: true,
        planId: true,
        status: true,
        plan: {
          select: {
            id: true,
            key: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return {
        tier: PLAN_TIERS.FREE,
        tierName: "FREE",
        planId: null,
        isSubscriber: false,
      };
    }

    // Helper to evaluate tier for a single subscription
    const resolveTier = (sub) => {
      const planKey = (sub.plan?.key || "").toLowerCase();
      const planName = (sub.plan?.name || "").toLowerCase();
      const planId = sub.planId;
      const price = sub.plan?.price || 0;

      // 1. FREE PLAN CHECK FIRST (Key 'free', name 'free plan', id 4353a25d..., or price 0)
      if (
        planId === FREE_PLAN_ID ||
        planKey === "free" ||
        planName.includes("free") ||
        price === 0
      ) {
        return {
          tier: PLAN_TIERS.FREE,
          tierName: "FREE",
          planId,
          planName: sub.plan?.name || "Free Plan",
          isSubscriber: false,
        };
      }

      // 2. PREMIUM PLAN CHECK
      if (
        planId === PREMIUM_PLAN_ID ||
        planKey === "premium" ||
        planKey === "pro" ||
        planName.includes("premium")
      ) {
        return {
          tier: PLAN_TIERS.PREMIUM,
          tierName: "PREMIUM",
          planId,
          planName: sub.plan?.name || "Premium",
          isSubscriber: true,
        };
      }

      // 3. BASIC PLAN CHECK
      if (
        planId === BASIC_PLAN_ID ||
        planKey === "basic" ||
        planKey === "standard" ||
        planName.includes("basic") ||
        planName.includes("standard")
      ) {
        return {
          tier: PLAN_TIERS.BASIC,
          tierName: "BASIC",
          planId,
          planName: sub.plan?.name || "Basic",
          isSubscriber: true,
        };
      }

      // Default paid plans without explicit tier key to at least BASIC
      return {
        tier: PLAN_TIERS.BASIC,
        tierName: "BASIC",
        planId,
        planName: sub.plan?.name || "Basic",
        isSubscriber: true,
      };
    };

    // Evaluate all active subscriptions and pick the highest tier
    let bestTierInfo = {
      tier: PLAN_TIERS.FREE,
      tierName: "FREE",
      planId: null,
      isSubscriber: false,
    };

    for (const sub of activeSubscriptions) {
      const resolved = resolveTier(sub);
      if (resolved.tier > bestTierInfo.tier) {
        bestTierInfo = resolved;
      }
    }

    // If user has only free subscription(s), keep subscriber status from resolveTier
    if (
      bestTierInfo.tier === PLAN_TIERS.FREE &&
      activeSubscriptions.length > 0
    ) {
      bestTierInfo = resolveTier(activeSubscriptions[0]);
    }

    return bestTierInfo;
  } catch (err) {
    console.error("Error resolving user plan tier:", err);
    return {
      tier: PLAN_TIERS.FREE,
      tierName: "FREE",
      planId: null,
      isSubscriber: false,
    };
  }
}

/**
 * Mock test limits:
 * - FREE: 1 full mock test per month
 * - BASIC: 10 full mock tests per month
 * - PREMIUM: Fair-use unlimited (3 full mock tests per week)
 */
export const MOCK_TEST_LIMITS = {
  FREE: { limit: 1, window: "monthly", label: "1 test / month" },
  BASIC: { limit: 10, window: "monthly", label: "10 tests / month" },
  PREMIUM: { limit: 3, window: "weekly", label: "3 tests / week (Fair-use)" },
};

/**
 * Checks a user's mock test quota based on their subscription tier and attempts history.
 */
export async function checkMockTestQuota(userId, prisma, isAdmin = false) {
  if (isAdmin) {
    return {
      allowed: true,
      isAdmin: true,
      tier: "ADMIN",
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      window: "unlimited",
      resetDate: null,
      message: "Admin unlimited access",
    };
  }

  const planInfo = await getUserPlanTier(userId, prisma);
  const tierName = planInfo.tierName || "FREE";
  const quotaConfig = MOCK_TEST_LIMITS[tierName] || MOCK_TEST_LIMITS.FREE;

  const now = new Date();
  let windowStart;
  let resetDate;

  if (quotaConfig.window === "weekly") {
    // 7-day rolling window or start of current week
    // Rolling 7 days:
    windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    resetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // indicative
  } else {
    // Calendar month start: 1st of current month at 00:00:00
    windowStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Reset date is 1st of next month
    resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // Count attempts within the window
  const used = userId
    ? await prisma.mockTestAttempt.count({
        where: {
          userId,
          createdAt: { gte: windowStart },
        },
      })
    : 0;

  const limit = quotaConfig.limit;
  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  return {
    allowed,
    isAdmin: false,
    tier: tierName,
    planName: planInfo.planName || tierName,
    used,
    limit,
    remaining,
    window: quotaConfig.window,
    resetDate,
    label: quotaConfig.label,
  };
}
