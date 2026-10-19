import prisma from "../config/prisma.js";
import {
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  cancelRazorpaySubscription,
  getRazorpay,
} from "./razorpay.service.js";
import { createRazorpayPlan } from "./razorpay.service.js";
export const createSubscription = async (userId, planId) => {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new Error("Invalid or inactive plan");
  }

  if (!plan.razorpayPlanId) {
    const razorpayPlan = await createRazorpayPlan({
      period: plan.billingInterval === "yearly" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.price * 100,
        currency: plan.currency || "INR",
      },
    });

    await prisma.plan.update({
      where: { id: planId },
      data: { razorpayPlanId: razorpayPlan.id },
    });

    plan.razorpayPlanId = razorpayPlan.id;
  }

  let razorpaySubscription;
  try {
    razorpaySubscription = await createRazorpaySubscription({
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: plan.billingInterval === "yearly" ? 1 : 12,
    });
  } catch (error) {
    if (error.statusCode === 400 && error.error?.code === "BAD_REQUEST_ERROR") {
      const razorpayPlan = await createRazorpayPlan({
        period: plan.billingInterval === "yearly" ? "yearly" : "monthly",
        interval: 1,
        item: {
          name: plan.name,
          amount: plan.price * 100,
          currency: plan.currency || "INR",
        },
      });

      await prisma.plan.update({
        where: { id: planId },
        data: { razorpayPlanId: razorpayPlan.id },
      });

      plan.razorpayPlanId = razorpayPlan.id;

      razorpaySubscription = await createRazorpaySubscription({
        plan_id: plan.razorpayPlanId,
        customer_notify: 1,
        total_count: plan.billingInterval === "yearly" ? 1 : 12,
      });
    } else {
      throw error;
    }
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId,
      razorpaySubscriptionId: razorpaySubscription.id,
      razorpayCustomerId: razorpaySubscription.customer_id,
      status: razorpaySubscription.status,
      currentStart: razorpaySubscription.current_start
        ? new Date(razorpaySubscription.current_start * 1000)
        : razorpaySubscription.start_at
          ? new Date(razorpaySubscription.start_at * 1000)
          : null,
      currentEnd: razorpaySubscription.current_end
        ? new Date(razorpaySubscription.current_end * 1000)
        : razorpaySubscription.end_at
          ? new Date(razorpaySubscription.end_at * 1000)
          : null,
    },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
        },
      },
    },
  });

  return subscription;
};

export const ensureUserFreeSubscription = async (userId) => {
  if (!userId) return null;

  try {
    const now = new Date();
    const existingActive = await prisma.subscription.findFirst({
      where: {
        userId,
        status: "active",
        OR: [
          { currentEnd: null },
          { currentEnd: { gt: now } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    if (existingActive) {
      return existingActive;
    }

    // Find the free plan
    let freePlan = await prisma.plan.findFirst({
      where: {
        OR: [
          { key: "free" },
          { price: 0 },
        ],
      },
    });

    if (!freePlan) {
      freePlan = await prisma.plan.create({
        data: {
          key: "free",
          name: "Free Plan",
          subtitle: "Default access to daily current affairs & practice",
          price: 0,
          currency: "INR",
          billingInterval: "lifetime",
          sortOrder: 0,
          isActive: true,
        },
      });
    }

    const freeSub = await prisma.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: "active",
        currentStart: new Date(),
        currentEnd: null, // lifetime / ongoing free access
      },
      include: { plan: true },
    });

    return freeSub;
  } catch (err) {
    console.error("Error ensuring free subscription for user:", err);
    return null;
  }
};

export const getMySubscription = async (userId) => {
  const now = new Date();
  const activeSubs = await prisma.subscription.findMany({
    where: {
      userId,
      status: "active",
      OR: [
        { currentEnd: null },
        { currentEnd: { gt: now } },
      ],
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (activeSubs.length > 0) {
    // If user has a paid active plan, prioritize it over the free plan
    const paidSub = activeSubs.find(
      (s) => s.plan && s.plan.price > 0 && s.plan.key !== "free"
    );
    return paidSub || activeSubs[0];
  }

  return ensureUserFreeSubscription(userId);
};


export const cancelSubscription = async (userId, subscriptionId) => {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const razorpaySubscription = await cancelRazorpaySubscription(
    subscription.razorpaySubscriptionId,
    {
      cancel_at_cycle_end: 1,
    },
  );

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtCycleEnd: true,
      status: razorpaySubscription.status,
      currentEnd: razorpaySubscription.end_at
        ? new Date(razorpaySubscription.end_at * 1000)
        : undefined,
    },
    include: { plan: true },
  });

  return updated;
};

export const updateSubscriptionFromWebhook = async (
  razorpaySubscriptionId,
  data,
) => {
  const subscription = await prisma.subscription.findUnique({
    where: { razorpaySubscriptionId },
  });

  if (!subscription) {
    return null;
  }

  const updateData = {
    status: data.status || subscription.status,
    currentStart: data.current_start
      ? new Date(data.current_start * 1000)
      : subscription.currentStart,
    currentEnd: data.current_end
      ? new Date(data.current_end * 1000)
      : subscription.currentEnd,
    cancelAtCycleEnd: data.cancel_at_cycle_end ?? subscription.cancelAtCycleEnd,
  };

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: updateData,
    include: { plan: true },
  });
};

/**
 * Revokes an existing subscription, sends notification email to user,
 * and downgrades the user to the Free plan.
 */
export const revokeAndDowngradeSubscription = async (
  subscriptionId,
  reason = "Your plan duration has ended."
) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!subscription) {
    return null;
  }

  // Update subscription status to 'revoked' (or 'cancelled' / 'expired')
  const updatedSub = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "expired",
      currentEnd: subscription.currentEnd || new Date(),
    },
    include: { plan: true },
  });

  // Assign/Ensure Free plan access for the user
  await ensureUserFreeSubscription(subscription.userId);

  // Send email notification to the user if email exists
  if (subscription.user?.email) {
    try {
      const { sendSubscriptionRevokedEmail } = await import(
        "../services/email.service.js"
      );
      await sendSubscriptionRevokedEmail({
        email: subscription.user.email,
        name: subscription.user.name,
        planName: subscription.plan?.name,
        billingInterval: subscription.plan?.billingInterval,
        endDate: updatedSub.currentEnd,
        reason,
      });
    } catch (err) {
      console.error(
        `Failed to send subscription revocation email to user ${subscription.user.email}:`,
        err
      );
    }
  }

  return updatedSub;
};

/**
 * Revoke all expired subscriptions whose currentEnd is in the past.
 * Called automatically by cron job.
 */
export const revokeExpiredSubscriptions = async () => {
  const now = new Date();

  // Find all subscriptions that are active, not free, and currentEnd < now
  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      currentEnd: {
        lte: now,
      },
      plan: {
        price: { gt: 0 },
      },
    },
    include: {
      plan: true,
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!expiredSubscriptions.length) {
    return { count: 0, revokedIds: [] };
  }

  const revokedIds = [];
  for (const sub of expiredSubscriptions) {
    try {
      await revokeAndDowngradeSubscription(
        sub.id,
        "Your subscription period has ended and was automatically revoked."
      );
      revokedIds.push(sub.id);
    } catch (err) {
      console.error(`Error revoking expired subscription ${sub.id}:`, err);
    }
  }

  return { count: revokedIds.length, revokedIds };
};

/**
 * Grant a premium trial (default 7 days) to a user
 */
export const grantPremiumTrial = async (userId, days = 7) => {
  // Find premium plan (e.g., key 'premium' or highest price plan that isn't free)
  let premiumPlan = await prisma.plan.findFirst({
    where: {
      key: { in: ["premium", "pro", "plus"] },
      isActive: true,
    },
    orderBy: { price: "desc" },
  });

  if (!premiumPlan) {
    premiumPlan = await prisma.plan.findFirst({
      where: {
        price: { gt: 0 },
        isActive: true,
      },
      orderBy: { price: "desc" },
    });
  }

  if (!premiumPlan) {
    throw new Error("No active premium plan found in the system");
  }

  const now = new Date();
  const trialEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Expire or cancel any current active subscriptions
  await prisma.subscription.updateMany({
    where: {
      userId,
      status: "active",
    },
    data: {
      status: "expired",
      currentEnd: now,
    },
  });

  // Create new active trial subscription
  const trialSub = await prisma.subscription.create({
    data: {
      userId,
      planId: premiumPlan.id,
      status: "active",
      currentStart: now,
      currentEnd: trialEnd,
      cancelAtCycleEnd: true,
    },
    include: {
      plan: true,
      user: {
        select: { id: true, name: true, email: true, phoneNumber: true },
      },
    },
  });

  return trialSub;
};

