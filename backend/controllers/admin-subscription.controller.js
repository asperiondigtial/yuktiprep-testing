import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getPagination, buildPaginationMeta } from "../utils/pagination.js";

export const adminGetSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = getPagination(req.query);

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          user: { select: { id: true, name: true, email: true, phoneNumber: true } },
          plan: true,
        },
      }),
      prisma.subscription.count(),
    ]);

    successResponse(res, "Subscriptions fetched successfully", subscriptions, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const adminRevokeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const { revokeAndDowngradeSubscription } = await import("../services/subscription.service.js");
    const revoked = await revokeAndDowngradeSubscription(
      id,
      reason || "Your subscription was revoked by an administrator."
    );

    if (!revoked) {
      return errorResponse(res, "Subscription not found", [], 404);
    }

    successResponse(res, "Subscription revoked and user notified successfully", revoked);
  } catch (error) {
    next(error);
  }
};

export const adminGrantPremiumTrial = async (req, res, next) => {
  try {
    const { userId, days = 7 } = req.body;
    if (!userId) {
      return errorResponse(res, "userId is required", [], 400);
    }

    const { grantPremiumTrial } = await import("../services/subscription.service.js");
    const trialSub = await grantPremiumTrial(userId, Number(days) || 7);

    successResponse(res, `Successfully granted ${days} days Premium trial`, trialSub);
  } catch (error) {
    next(error);
  }
};

export const adminDowngradeToFree = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return errorResponse(res, "userId is required", [], 400);
    }

    const now = new Date();
    // Expire all existing active subscriptions for this user
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

    const { ensureUserFreeSubscription } = await import("../services/subscription.service.js");
    const freeSub = await ensureUserFreeSubscription(userId);

    successResponse(res, "Successfully revoked active plans and downgraded user to Free plan", freeSub);
  } catch (error) {
    next(error);
  }
};

