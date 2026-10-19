import prisma from "../../config/prisma.js";
import { successResponse, errorResponse } from "../../utils/response.js";

/**
 * Helper to generate URL-safe slug from string
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

/* ========================================================
   EXAM GROUPS (ADMIN)
======================================================== */

/**
 * GET /api/v1/admin/exam-groups
 * Returns all exam groups with their examOptions count
 */
export async function adminGetExamGroups(req, res, next) {
  try {
    const groups = await prisma.examGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { examOptions: true, users: true },
        },
      },
    });

    return successResponse(res, "Exam groups fetched", groups);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/exam-groups/:id
 */
export async function adminGetExamGroupById(req, res, next) {
  try {
    const { id } = req.params;
    const group = await prisma.examGroup.findUnique({
      where: { id },
      include: {
        examOptions: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!group) {
      return errorResponse(res, "Exam group not found", [], 404);
    }

    return successResponse(res, "Exam group details", group);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/exam-groups
 */
export async function adminCreateExamGroup(req, res, next) {
  try {
    const { name, slug, description, logoUrl, isActive = true, sortOrder = 0 } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return errorResponse(res, "Name is required", [], 400);
    }

    const generatedSlug = slug?.trim() ? slugify(slug) : slugify(name);

    const existing = await prisma.examGroup.findUnique({
      where: { slug: generatedSlug },
    });
    if (existing) {
      return errorResponse(res, "An exam group with this slug already exists", [], 400);
    }

    const group = await prisma.examGroup.create({
      data: {
        name: name.trim(),
        slug: generatedSlug,
        description: description?.trim() || null,
        logoUrl: logoUrl?.trim() || null,
        isActive: Boolean(isActive),
        sortOrder: parseInt(sortOrder, 10) || 0,
      },
    });

    return successResponse(res, "Exam group created successfully", group, {}, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/admin/exam-groups/:id
 */
export async function adminUpdateExamGroup(req, res, next) {
  try {
    const { id } = req.params;
    const { name, slug, description, logoUrl, isActive, sortOrder } = req.body;

    const existing = await prisma.examGroup.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, "Exam group not found", [], 404);
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (slug !== undefined) {
      const formattedSlug = slugify(slug);
      if (formattedSlug !== existing.slug) {
        const slugExists = await prisma.examGroup.findUnique({ where: { slug: formattedSlug } });
        if (slugExists) {
          return errorResponse(res, "An exam group with this slug already exists", [], 400);
        }
      }
      updateData.slug = formattedSlug;
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10) || 0;

    const updated = await prisma.examGroup.update({
      where: { id },
      data: updateData,
    });

    return successResponse(res, "Exam group updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/exam-groups/:id
 */
export async function adminDeleteExamGroup(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.examGroup.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) {
      return errorResponse(res, "Exam group not found", [], 404);
    }

    // If users are assigned to this group, nullify their examGroupId so deletion succeeds
    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { examGroupId: id },
        data: { examGroupId: null, examOptionId: null },
      });

      await tx.examGroup.delete({
        where: { id },
      });
    });

    return successResponse(res, "Exam group and its options deleted successfully");
  } catch (error) {
    next(error);
  }
}

/* ========================================================
   EXAM OPTIONS (ADMIN)
======================================================== */

/**
 * GET /api/v1/admin/exam-options?examGroupId=...
 */
export async function adminGetExamOptions(req, res, next) {
  try {
    const { examGroupId } = req.query;
    const where = {};
    if (examGroupId) {
      where.examGroupId = examGroupId;
    }

    const options = await prisma.examOption.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        examGroup: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    return successResponse(res, "Exam options fetched", options);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/exam-options
 */
export async function adminCreateExamOption(req, res, next) {
  try {
    const { examGroupId, title, logoUrl, isActive = true, sortOrder = 0 } = req.body;

    if (!examGroupId) {
      return errorResponse(res, "examGroupId is required", [], 400);
    }
    if (!title || typeof title !== "string" || !title.trim()) {
      return errorResponse(res, "Title is required", [], 400);
    }

    const group = await prisma.examGroup.findUnique({ where: { id: examGroupId } });
    if (!group) {
      return errorResponse(res, "Target exam group does not exist", [], 404);
    }

    const option = await prisma.examOption.create({
      data: {
        examGroupId,
        title: title.trim(),
        logoUrl: logoUrl?.trim() || null,
        isActive: Boolean(isActive),
        sortOrder: parseInt(sortOrder, 10) || 0,
      },
      include: {
        examGroup: {
          select: { id: true, name: true },
        },
      },
    });

    return successResponse(res, "Exam option created successfully", option, {}, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/admin/exam-options/:id
 */
export async function adminUpdateExamOption(req, res, next) {
  try {
    const { id } = req.params;
    const { examGroupId, title, logoUrl, isActive, sortOrder } = req.body;

    const existing = await prisma.examOption.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, "Exam option not found", [], 404);
    }

    const updateData = {};
    if (examGroupId !== undefined) {
      const group = await prisma.examGroup.findUnique({ where: { id: examGroupId } });
      if (!group) {
        return errorResponse(res, "Target exam group does not exist", [], 404);
      }
      updateData.examGroupId = examGroupId;
    }
    if (title !== undefined) updateData.title = title.trim();
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl?.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder, 10) || 0;

    const updated = await prisma.examOption.update({
      where: { id },
      data: updateData,
      include: {
        examGroup: {
          select: { id: true, name: true },
        },
      },
    });

    return successResponse(res, "Exam option updated successfully", updated);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/exam-options/:id
 */
export async function adminDeleteExamOption(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.examOption.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, "Exam option not found", [], 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { examOptionId: id },
        data: { examOptionId: null },
      });

      await tx.examOption.delete({ where: { id } });
    });

    return successResponse(res, "Exam option deleted successfully");
  } catch (error) {
    next(error);
  }
}
