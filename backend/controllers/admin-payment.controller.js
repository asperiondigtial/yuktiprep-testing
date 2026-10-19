import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getPagination, buildPaginationMeta } from "../utils/pagination.js";

export const adminGetPayments = async (req, res, next) => {
  try {
    const { page, limit, skip, sort = "createdAt", order = "desc" } = getPagination(req.query);
    const { search, status } = req.query;

    const where = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { razorpayPaymentId: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phoneNumber: { contains: q, mode: "insensitive" } } },
        { plan: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [payments, total, stats] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          user: { select: { id: true, name: true, email: true, phoneNumber: true } },
          plan: { select: { id: true, name: true, key: true, price: true, currency: true } },
          subscription: {
            select: {
              id: true,
              razorpaySubscriptionId: true,
              status: true,
              currentStart: true,
              currentEnd: true,
            },
          },
          refundRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              reason: true,
              amount: true,
              createdAt: true,
              razorpayRefundId: true,
            },
          },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = stats._sum.amount || 0;

    successResponse(
      res,
      "Payments fetched successfully",
      payments,
      {
        ...buildPaginationMeta(total, page, limit),
        totalRevenue,
      }
    );
  } catch (error) {
    next(error);
  }
};
