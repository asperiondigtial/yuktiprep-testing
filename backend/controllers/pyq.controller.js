import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getPagination, buildPaginationMeta } from "../utils/pagination.js";
import { pyqSchema, bulkPyqSchema, pyqQuerySchema } from "../validators/pyq.validator.js";
import * as pyqService from "../services/pyq.service.js";
import { getUserPlanTier, PLAN_TIERS } from "../utils/planTier.js";

export const getPyqs = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = getPagination(req.query);

    // Resolve user tier if user is authenticated (or req.user is set)
    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const isPremium = userTierInfo.tier >= PLAN_TIERS.PREMIUM;
    const isBasic = userTierInfo.tier === PLAN_TIERS.BASIC;
    const isFree = userTierInfo.tier === PLAN_TIERS.FREE;

    // Admin / privileged users bypass tier limits if role is present
    const isAdmin = Boolean(req.admin || (req.user && ["ADMIN", "SUPER_ADMIN", "EDITOR"].includes(req.user.role)));

    const maxPerPaper = isAdmin || isPremium ? Infinity : isBasic ? 10 : 5;
    const canViewAnswers = isAdmin || !isFree;

    const { pyqs, total } = await pyqService.getPyqs({
      examId: req.query.examId,
      subjectId: req.query.subjectId,
      topicId: req.query.topicId,
      year: req.query.year,
      difficulty: req.query.difficulty,
      search: req.query.search,
      skip,
      take: limit,
      sort,
      order,
    });

    // Group and limit per exam paper (paper || examId)
    const paperCountMap = new Map();
    const filteredPyqs = [];

    for (const item of pyqs) {
      const paperKey = `${item.paper || item.exam?.name || item.examId || "General"}-${item.year || 0}`;
      const count = paperCountMap.get(paperKey) || 0;

      if (count < maxPerPaper) {
        paperCountMap.set(paperKey, count + 1);

        if (!canViewAnswers) {
          filteredPyqs.push({
            ...item,
            correctAnswer: null,
            explanation: null,
            isAnswerLocked: true,
          });
        } else {
          filteredPyqs.push({
            ...item,
            isAnswerLocked: false,
          });
        }
      }
    }

    const meta = buildPaginationMeta(total, page, limit);
    meta.planTier = userTierInfo.tierName;
    meta.tierLevel = userTierInfo.tier;
    meta.maxPerPaper = isAdmin || isPremium ? "ALL" : maxPerPaper;
    meta.canViewAnswers = canViewAnswers;

    successResponse(res, "PYQs fetched successfully", filteredPyqs, meta);
  } catch (error) {
    next(error);
  }
};

export const getPyqById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pyq = await pyqService.getPyqById(id);

    if (!pyq) {
      return errorResponse(res, "PYQ not found", [], 404);
    }

    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const isAdmin = Boolean(req.admin || (req.user && ["ADMIN", "SUPER_ADMIN", "EDITOR"].includes(req.user.role)));
    const canViewAnswers = isAdmin || userTierInfo.tier !== PLAN_TIERS.FREE;

    if (!canViewAnswers) {
      return successResponse(res, "PYQ fetched successfully", {
        ...pyq,
        correctAnswer: null,
        explanation: null,
        isAnswerLocked: true,
      });
    }

    successResponse(res, "PYQ fetched successfully", {
      ...pyq,
      isAnswerLocked: false,
    });
  } catch (error) {
    next(error);
  }
};

export const createPyq = async (req, res, next) => {
  try {
    const validated = pyqSchema.parse(req.body);
    const pyq = await pyqService.createPyq(validated);
    successResponse(res, "PYQ created successfully", pyq, {}, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    next(error);
  }
};

export const updatePyq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = pyqSchema.partial().parse(req.body);
    const pyq = await pyqService.updatePyq(id, validated);
    successResponse(res, "PYQ updated successfully", pyq);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    if (error.code === "P2025") {
      return errorResponse(res, "PYQ not found", [], 404);
    }
    next(error);
  }
};

export const deletePyq = async (req, res, next) => {
  try {
    const { id } = req.params;
    await pyqService.deletePyq(id);
    successResponse(res, "PYQ deleted successfully");
  } catch (error) {
    if (error.code === "P2025") {
      return errorResponse(res, "PYQ not found", [], 404);
    }
    next(error);
  }
};

export const bulkCreatePyqs = async (req, res, next) => {
  try {
    const validated = bulkPyqSchema.parse(req.body);
    const result = await pyqService.bulkCreatePyqs(validated.pyqs);
    successResponse(res, `${result.count} PYQs created successfully`, { count: result.count }, {}, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    next(error);
  }
};

export const bulkDeletePyqs = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, "IDs array is required", [], 400);
    }

    const result = await pyqService.bulkDeletePyqs(ids);
    successResponse(res, `${result.count} PYQs deleted successfully`, { count: result.count });
  } catch (error) {
    next(error);
  }
};
