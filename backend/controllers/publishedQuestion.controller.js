import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getUserPlanTier, PLAN_TIERS } from "../utils/planTier.js";

/**
 * Get published questions for learners with tier-based limits and access control.
 * - FREE: 5 questions per exam paper, answers/explanations omitted.
 * - BASIC: 10 questions per exam paper, answers/explanations included.
 * - PREMIUM: Complete repository, answers/explanations included.
 */
export const getPublishedQuestions = async (req, res, next) => {
  try {
    const {
      examId,
      subjectId,
      topicId,
      difficulty,
      bloomLevel,
      language = "en",
      year,
      search,
      page = 1,
      limit = 100,
    } = req.query;

    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const isPremium = userTierInfo.tier >= PLAN_TIERS.PREMIUM;
    const isBasic = userTierInfo.tier === PLAN_TIERS.BASIC;
    const isFree = userTierInfo.tier === PLAN_TIERS.FREE;

    // Per-paper question caps
    const maxPerPaper = isPremium ? Infinity : isBasic ? 10 : 5;
    const canViewAnswers = !isFree;

    const where = {
      isPublished: true,
      isActive: true,
    };

    if (examId) where.examId = examId;
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (difficulty) where.difficulty = difficulty;
    if (bloomLevel) where.bloomLevel = bloomLevel;
    if (language) where.language = language;
    if (year) where.sourceYear = Number(year);
    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: "insensitive" } },
        { explanation: { contains: search, mode: "insensitive" } },
      ];
    }

    const requestedLimit = Math.min(Number(limit) || 100, 200);
    const skip = (Number(page) - 1) * requestedLimit;

    const [total, questions] = await Promise.all([
      prisma.publishedQuestion.count({ where }),
      prisma.publishedQuestion.findMany({
        where,
        skip,
        take: requestedLimit,
        orderBy: [{ sourceYear: "desc" }, { createdAt: "desc" }],
        include: {
          exam: { select: { id: true, name: true, slug: true } },
          subject: { select: { id: true, name: true, slug: true } },
          topic: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    // Group and limit per exam paper (sourceName + sourceYear)
    const paperCountMap = new Map();
    const filteredQuestions = [];

    for (const q of questions) {
      const paperKey = `${q.sourceName || q.exam?.name || "Exam"}-${q.sourceYear || 0}`;
      const count = paperCountMap.get(paperKey) || 0;

      if (count < maxPerPaper) {
        paperCountMap.set(paperKey, count + 1);

        // Sanitize answers & explanations for Free tier
        if (!canViewAnswers) {
          const sanitizedOptions = Array.isArray(q.options)
            ? q.options.map((opt) => ({
                id: opt.id,
                key: opt.key,
                text: opt.text,
                // do NOT leak isCorrect
              }))
            : q.options;

          filteredQuestions.push({
            ...q,
            options: sanitizedOptions,
            correctAnswer: null,
            explanation: null,
            isAnswerLocked: true,
          });
        } else {
          filteredQuestions.push({
            ...q,
            isAnswerLocked: false,
          });
        }
      }
    }

    return successResponse(res, "Published questions retrieved successfully", filteredQuestions, {
      total,
      page: Number(page),
      limit: requestedLimit,
      planTier: userTierInfo.tierName,
      tierLevel: userTierInfo.tier,
      maxPerPaper: isPremium ? "ALL" : maxPerPaper,
      canViewAnswers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get question details by ID.
 */
export const getPublishedQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await prisma.publishedQuestion.findUnique({
      where: { id },
      include: {
        exam: true,
        subject: true,
        topic: true,
      },
    });

    if (!question || !question.isPublished) {
      return errorResponse(res, "Question not found", [], 404);
    }

    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const canViewAnswers = userTierInfo.tier !== PLAN_TIERS.FREE;

    if (!canViewAnswers) {
      const sanitizedOptions = Array.isArray(question.options)
        ? question.options.map((opt) => ({
            id: opt.id,
            key: opt.key,
            text: opt.text,
          }))
        : question.options;

      return successResponse(res, "Question retrieved successfully", {
        ...question,
        options: sanitizedOptions,
        correctAnswer: null,
        explanation: null,
        isAnswerLocked: true,
      });
    }

    return successResponse(res, "Question retrieved successfully", {
      ...question,
      isAnswerLocked: false,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get theory/mains questions from the MainsQuestion table (no options or MCQ answers).
 */
export const getMainsQuestions = async (req, res, next) => {
  try {
    const {
      examId,
      subjectId,
      topicId,
      difficulty,
      bloomLevel,
      language = "en",
      year,
      search,
      page = 1,
      limit = 100,
    } = req.query;

    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const isPremium = userTierInfo.tier >= PLAN_TIERS.PREMIUM;
    const isBasic = userTierInfo.tier === PLAN_TIERS.BASIC;
    const isFree = userTierInfo.tier === PLAN_TIERS.FREE;

    // Per-paper question caps
    const maxPerPaper = isPremium ? Infinity : isBasic ? 10 : 5;
    const canViewModelAnswer = !isFree;

    const where = {
      isPublished: true,
      isActive: true,
    };

    if (examId) where.examId = examId;
    if (subjectId) where.subjectId = subjectId;
    if (topicId) where.topicId = topicId;
    if (difficulty) where.difficulty = difficulty;
    if (bloomLevel) where.bloomLevel = bloomLevel;
    if (language) where.language = language;
    if (year) where.sourceYear = Number(year);
    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: "insensitive" } },
        { modelAnswer: { contains: search, mode: "insensitive" } },
      ];
    }

    const requestedLimit = Math.min(Number(limit) || 100, 200);
    const skip = (Number(page) - 1) * requestedLimit;

    const [total, questions] = await Promise.all([
      prisma.mainsQuestion.count({ where }),
      prisma.mainsQuestion.findMany({
        where,
        skip,
        take: requestedLimit,
        orderBy: [{ sourceYear: "desc" }, { createdAt: "desc" }],
        include: {
          exam: { select: { id: true, name: true, slug: true } },
          subject: { select: { id: true, name: true, slug: true } },
          topic: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    // Group and limit per exam paper (sourceName + sourceYear)
    const paperCountMap = new Map();
    const filteredQuestions = [];

    for (const q of questions) {
      const paperKey = `${q.sourceName || q.exam?.name || "Exam"}-${q.sourceYear || 0}`;
      const count = paperCountMap.get(paperKey) || 0;

      if (count < maxPerPaper) {
        paperCountMap.set(paperKey, count + 1);

        if (!canViewModelAnswer) {
          filteredQuestions.push({
            ...q,
            modelAnswer: null,
            evaluationCriteria: null,
            isAnswerLocked: true,
          });
        } else {
          filteredQuestions.push({
            ...q,
            isAnswerLocked: false,
          });
        }
      }
    }

    return successResponse(res, "Theory / Mains questions retrieved successfully", filteredQuestions, {
      total,
      page: Number(page),
      limit: requestedLimit,
      planTier: userTierInfo.tierName,
      tierLevel: userTierInfo.tier,
      maxPerPaper: isPremium ? "ALL" : maxPerPaper,
      canViewModelAnswer,
      type: "THEORY",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get theory/mains question details by ID.
 */
export const getMainsQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const question = await prisma.mainsQuestion.findUnique({
      where: { id },
      include: {
        exam: true,
        subject: true,
        topic: true,
      },
    });

    if (!question || !question.isPublished) {
      return errorResponse(res, "Theory question not found", [], 404);
    }

    const userTierInfo = await getUserPlanTier(req.user?.id, prisma);
    const canViewModelAnswer = userTierInfo.tier !== PLAN_TIERS.FREE;

    if (!canViewModelAnswer) {
      return successResponse(res, "Theory question retrieved successfully", {
        ...question,
        modelAnswer: null,
        evaluationCriteria: null,
        isAnswerLocked: true,
      });
    }

    return successResponse(res, "Theory question retrieved successfully", {
      ...question,
      isAnswerLocked: false,
    });
  } catch (error) {
    next(error);
  }
};
