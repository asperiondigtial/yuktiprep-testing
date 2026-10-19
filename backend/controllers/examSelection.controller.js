import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";

/**
 * Public/User: GET /api/v1/exam-groups
 * Returns only active ExamGroups and their active ExamOptions, sorted by sortOrder asc
 */
export async function getActiveExamGroups(req, res, next) {
  try {
    const examGroups = await prisma.examGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        examOptions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            logoUrl: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },
    });

    return successResponse(res, "Exam groups fetched successfully", examGroups);
  } catch (error) {
    next(error);
  }
}

/**
 * User: POST /api/v1/users/me/exam-selection
 * Validates group, option, and their association, sets user examGroupId, examOptionId and active = true
 */
export async function saveUserExamSelection(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, "Not authorized", [], 401);
    }

    const { examGroupId, examOptionId } = req.body;

    if (!examGroupId || !examOptionId) {
      return errorResponse(res, "Both examGroupId and examOptionId are required", [], 400);
    }

    // Atomic transaction: validate and update user
    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Verify exam group exists and is active
      const group = await tx.examGroup.findUnique({
        where: { id: examGroupId },
      });

      if (!group || !group.isActive) {
        throw new Error("EXAM_GROUP_NOT_FOUND_OR_INACTIVE");
      }

      // 2. Verify exam option exists, is active, and belongs to this group
      const option = await tx.examOption.findUnique({
        where: { id: examOptionId },
      });

      if (!option || !option.isActive) {
        throw new Error("EXAM_OPTION_NOT_FOUND_OR_INACTIVE");
      }

      if (option.examGroupId !== examGroupId) {
        throw new Error("EXAM_OPTION_MISMATCH");
      }

      // 3. Update user and activate account
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          examGroupId,
          examOptionId,
          active: true,
        },
        include: {
          examGroup: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          examOption: {
            select: { id: true, title: true, logoUrl: true },
          },
        },
      });

      return user;
    });

    return successResponse(res, "Exam selection saved successfully. Account activated.", updatedUser);
  } catch (error) {
    if (error.message === "EXAM_GROUP_NOT_FOUND_OR_INACTIVE") {
      return errorResponse(res, "Selected exam group is not found or inactive", [], 400);
    }
    if (error.message === "EXAM_OPTION_NOT_FOUND_OR_INACTIVE") {
      return errorResponse(res, "Selected exam option is not found or inactive", [], 400);
    }
    if (error.message === "EXAM_OPTION_MISMATCH") {
      return errorResponse(res, "Selected exam option does not belong to the selected exam group", [], 400);
    }
    next(error);
  }
}
