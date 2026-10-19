import prisma from "../config/prisma.js";
import { errorResponse, successResponse } from "../utils/response.js";
import { createRazorpayRefund } from "../services/razorpay.service.js";
import {
  sendRefundRequestedUserEmail,
  sendRefundRequestedAdminEmail,
  sendRefundProcessedUserEmail,
  sendRefundRejectedUserEmail,
} from "../services/email.service.js";

const REFUND_WINDOW_DAYS = 7;

/**
 * Check if the current user has a subscription eligible for refund
 */
export const checkRefundEligibility = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.admin?.id;
    if (!userId) {
      return errorResponse(res, "Authentication required", [], 401);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId,
        status: { in: ["active", "cancelled"] },
        plan: {
          price: { gt: 0 },
          key: { not: "free" },
        },
      },
      include: {
        plan: true,
        payments: {
          where: { status: "captured" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        refundRequests: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const eligibleSubscriptions = subscriptions.map((sub) => {
      const payment = sub.payments?.[0];
      const existingRefund = sub.refundRequests?.[0];
      const planName = sub.plan?.name || "Subscription Plan";
      const planPrice = sub.plan?.price || 0;
      const planCurrency = sub.plan?.currency || "INR";

      if (!payment) {
        return {
          subscriptionId: sub.id,
          planName,
          amount: planPrice,
          currency: planCurrency,
          isEligible: false,
          reason: "No captured payment found",
          existingRefund: null,
        };
      }

      if (existingRefund) {
        return {
          subscriptionId: sub.id,
          planName,
          amount: payment.amount,
          currency: payment.currency,
          paymentDate: payment.createdAt,
          isEligible: false,
          reason: `Refund is already ${existingRefund.status.toLowerCase()}`,
          existingRefund,
        };
      }

      const paymentDate = new Date(payment.createdAt);
      const diffMs = Date.now() - paymentDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const daysRemaining = Math.max(0, Math.ceil(REFUND_WINDOW_DAYS - diffDays));
      const isEligible = diffDays <= REFUND_WINDOW_DAYS;

      return {
        subscriptionId: sub.id,
        paymentId: payment.id,
        planName,
        amount: payment.amount,
        currency: payment.currency,
        paymentDate: payment.createdAt,
        isEligible,
        daysRemaining: isEligible ? daysRemaining : 0,
        reason: isEligible ? null : `Purchase date was more than ${REFUND_WINDOW_DAYS} days ago`,
        existingRefund: null,
      };
    });

    return successResponse(res, "Refund eligibility fetched", {
      refundWindowDays: REFUND_WINDOW_DAYS,
      subscriptions: eligibleSubscriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * User requests a refund
 */
export const requestRefund = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, "Authentication required", [], 401);
    }

    const { subscriptionId, reason } = req.body;
    if (!subscriptionId) {
      return errorResponse(res, "Subscription ID is required", [], 400);
    }
    if (!reason || reason.trim().length < 5) {
      return errorResponse(res, "Please provide a valid refund reason (minimum 5 characters)", [], 400);
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        user: true,
        payments: {
          where: { status: "captured" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!subscription || subscription.userId !== userId) {
      return errorResponse(res, "Subscription not found", [], 404);
    }

    const latestPayment = subscription.payments[0];
    if (!latestPayment) {
      return errorResponse(res, "No captured payment found for this subscription", [], 400);
    }

    const paymentDate = new Date(latestPayment.createdAt);
    const diffDays = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays > REFUND_WINDOW_DAYS) {
      return errorResponse(
        res,
        `Refund window expired. Refunds are only allowed within ${REFUND_WINDOW_DAYS} days of purchase.`,
        [],
        400
      );
    }

    // Check if duplicate request exists
    const existing = await prisma.refundRequest.findFirst({
      where: {
        paymentId: latestPayment.id,
        status: { in: ["PENDING", "APPROVED", "PROCESSED"] },
      },
    });
    if (existing) {
      return errorResponse(res, `A refund request for this subscription is already ${existing.status.toLowerCase()}.`, [], 400);
    }

    const refundRequest = await prisma.refundRequest.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        paymentId: latestPayment.id,
        amount: latestPayment.amount,
        currency: latestPayment.currency,
        reason: reason.trim(),
        status: "PENDING",
      },
    });

    // Send emails asynchronously
    try {
      await Promise.allSettled([
        sendRefundRequestedUserEmail({
          user: subscription.user,
          planName: subscription.plan.name,
          amount: latestPayment.amount,
          currency: latestPayment.currency,
          reason: reason.trim(),
          refundId: refundRequest.id,
        }),
        sendRefundRequestedAdminEmail({
          user: subscription.user,
          planName: subscription.plan.name,
          amount: latestPayment.amount,
          currency: latestPayment.currency,
          reason: reason.trim(),
          refundId: refundRequest.id,
        }),
      ]);
    } catch (e) {
      console.error("[Email Error sending refund notifications]:", e.message);
    }

    return successResponse(
      res,
      "Refund request submitted successfully. It will be reviewed by our team.",
      refundRequest,
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * User views their refund requests
 */
export const getMyRefundRequests = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, "Authentication required", [], 401);
    }

    const refunds = await prisma.refundRequest.findMany({
      where: { userId },
      include: {
        subscription: {
          include: { plan: true },
        },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(res, "Refund requests fetched successfully", refunds);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: List all refund requests
 */
export const adminGetRefundRequests = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = {};
    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { id: { equals: q } },
        { razorpayRefundId: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [refunds, total] = await Promise.all([
      prisma.refundRequest.findMany({
        where,
        skip,
        take: parseInt(limit, 10),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true, phoneNumber: true } },
          subscription: {
            include: { plan: { select: { id: true, name: true, key: true } } },
          },
          payment: { select: { id: true, razorpayPaymentId: true, amount: true, currency: true, method: true } },
        },
      }),
      prisma.refundRequest.count({ where }),
    ]);

    return successResponse(res, "Refund requests fetched", refunds, {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Process refund (Approve via Razorpay or Reject)
 */
export const adminProcessRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body; // "APPROVED", "REJECTED", or "MANUAL_PROCESSED"
    const adminId = req.admin?.id || req.user?.id;

    if (!["APPROVED", "REJECTED", "MANUAL_PROCESSED"].includes(status)) {
      return errorResponse(res, "Status must be either APPROVED, REJECTED, or MANUAL_PROCESSED", [], 400);
    }

    const refundReq = await prisma.refundRequest.findUnique({
      where: { id },
      include: {
        payment: true,
        user: true,
        subscription: { include: { plan: true } },
      },
    });

    if (!refundReq) {
      return errorResponse(res, "Refund request not found", [], 404);
    }

    if (refundReq.status !== "PENDING") {
      return errorResponse(res, `Cannot process a refund request that is already ${refundReq.status}`, [], 400);
    }

    if (status === "REJECTED") {
      const updated = await prisma.refundRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNote: adminNote || null,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });

      try {
        await sendRefundRejectedUserEmail({
          user: refundReq.user,
          planName: refundReq.subscription.plan.name,
          adminNote,
        });
      } catch (err) {
        console.error("[Email Error rejecting refund]:", err.message);
      }

      return successResponse(res, "Refund request rejected successfully", updated);
    }

    // Process APPROVED status: Call Razorpay Refund API (Skip if MANUAL_PROCESSED)
    let rzpRefund = null;
    if (status === "APPROVED" && refundReq.payment.razorpayPaymentId) {
      try {
        const isPaise = refundReq.amount >= 1000 && refundReq.amount % 100 === 0;
        const amountInPaise = isPaise ? refundReq.amount : Math.round(refundReq.amount * 100);

        rzpRefund = await createRazorpayRefund(
          refundReq.payment.razorpayPaymentId,
          amountInPaise,
          {
            refundRequestId: String(refundReq.id),
            userId: String(refundReq.userId),
            subscriptionId: String(refundReq.subscriptionId),
          }
        );
      } catch (rzpErr) {
        console.error("[Razorpay Refund Error]:", JSON.stringify(rzpErr, null, 2));
        const errMsg = rzpErr.error?.description || rzpErr.description || rzpErr.message || "Unknown error";
        
        // If the admin explicitly provided manual approval in notes or if razorpay balance is 0 in test mode
        const isBalanceError =
          errMsg.toLowerCase().includes("not have enough balance") ||
          errMsg.toLowerCase().includes("balance to carry out the refund");

        if (isBalanceError) {
          return errorResponse(
            res,
            `Razorpay Refund Failed: Your Razorpay test/live account does not have enough balance to process this automated refund. Please add funds to your Razorpay dashboard or issue a manual refund.`,
            [],
            400
          );
        }

        return errorResponse(res, `Razorpay Refund Failed: ${errMsg}`, [], 400);
      }
    }

    // Atomically update RefundRequest, Subscription, and Payment status
    const [updatedRefund] = await prisma.$transaction([
      prisma.refundRequest.update({
        where: { id },
        data: {
          status: "PROCESSED",
          razorpayRefundId: rzpRefund?.id || "MANUAL_PROCESSED",
          rawResponse: rzpRefund || {},
          adminNote: adminNote || null,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      prisma.subscription.update({
        where: { id: refundReq.subscriptionId },
        data: { status: "cancelled", cancelAtCycleEnd: false },
      }),
      prisma.payment.update({
        where: { id: refundReq.paymentId },
        data: { status: "refunded" },
      }),
    ]);

    // Send emails
    try {
      await sendRefundProcessedUserEmail({
        user: refundReq.user,
        planName: refundReq.subscription.plan.name,
        amount: refundReq.amount,
        currency: refundReq.currency,
        razorpayRefundId: rzpRefund?.id,
      });
    } catch (err) {
      console.error("[Email Error sending processed refund]:", err.message);
    }

    return successResponse(res, "Refund processed and approved successfully via Razorpay", updatedRefund);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Directly initiate a refund for any captured payment
 */
export const adminDirectRefund = async (req, res, next) => {
  try {
    const { paymentId, reason, amount } = req.body;
    const adminId = req.admin?.id || req.user?.id;

    if (!paymentId) {
      return errorResponse(res, "Payment ID is required", [], 400);
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        plan: true,
        subscription: true,
        refundRequests: true,
      },
    });

    if (!payment) {
      return errorResponse(res, "Payment transaction not found", [], 404);
    }

    if (payment.status === "refunded") {
      return errorResponse(res, "This payment has already been refunded.", [], 400);
    }

    // Check if user or admin has already requested/processed a refund for this payment
    const existingRefund = await prisma.refundRequest.findFirst({
      where: {
        paymentId: payment.id,
        status: { in: ["PENDING", "APPROVED", "PROCESSED"] },
      },
    });

    if (existingRefund) {
      if (existingRefund.status === "PENDING") {
        return errorResponse(
          res,
          `A refund request is already pending review for this payment (Reason: "${existingRefund.reason || "Not specified"}"). You can review and approve/reject it from Refund Requests.`,
          [],
          400
        );
      } else {
        return errorResponse(
          res,
          `A refund for this payment has already been ${existingRefund.status.toLowerCase()} (Refund ID: ${existingRefund.razorpayRefundId || existingRefund.id}).`,
          [],
          400
        );
      }
    }

    // Determine if payment.amount or passed amount is in Rupees or Paise:
    // Razorpay standard amounts in webhooks are in paise (e.g. 19900 or 49900).
    // In some manual flows it may be stored in Rupees (e.g. 199, 499).
    const rawAmount = amount !== undefined && amount !== null ? Number(amount) : payment.amount;
    const isPaise = rawAmount >= 1000 && rawAmount % 100 === 0;
    const amountInPaise = isPaise ? rawAmount : Math.round(rawAmount * 100);
    const refundAmountInRupees = isPaise ? rawAmount / 100 : rawAmount;

    let rzpRefund = null;
    if (payment.razorpayPaymentId) {
      try {
        const cleanNotes = {
          paymentId: String(payment.id),
          userId: String(payment.userId),
          adminInitiated: "true",
          reason: String(reason || "Admin direct refund").slice(0, 250),
        };
        rzpRefund = await createRazorpayRefund(payment.razorpayPaymentId, amountInPaise, cleanNotes);
      } catch (rzpErr) {
        console.error("[Admin Direct Razorpay Refund Error Details]:", JSON.stringify(rzpErr, null, 2));
        const errMsg =
          rzpErr.error?.description ||
          rzpErr.description ||
          rzpErr.message ||
          "Razorpay rejected the refund request";
        return errorResponse(res, `Razorpay Refund Failed: ${errMsg}`, [], 400);
      }
    }

    // Record or update RefundRequest, downgrade Subscription and mark Payment refunded
    const [refundRequest] = await prisma.$transaction([
      prisma.refundRequest.create({
        data: {
          userId: payment.userId,
          subscriptionId: payment.subscriptionId,
          paymentId: payment.id,
          amount: Math.round(refundAmountInRupees),
          currency: payment.currency,
          reason: reason?.trim() || "Admin initiated refund",
          status: "PROCESSED",
          razorpayRefundId: rzpRefund?.id || "MANUAL_ADMIN_REFUND",
          rawResponse: rzpRefund || {},
          adminNote: "Directly issued by administrator",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      }),
      prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: "cancelled", cancelAtCycleEnd: false },
      }),
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "refunded" },
      }),
    ]);

    // Send confirmation email to user
    try {
      await sendRefundProcessedUserEmail({
        user: payment.user,
        planName: payment.plan?.name || "Subscription Plan",
        amount: refundAmountInRupees,
        currency: payment.currency,
        razorpayRefundId: rzpRefund?.id,
      });
    } catch (err) {
      console.error("[Email Error sending admin direct refund]:", err.message);
    }

    return successResponse(res, "Refund initiated and processed successfully via Razorpay", refundRequest);
  } catch (error) {
    next(error);
  }
};

