import prisma from "../../config/prisma.js";
import { successResponse, errorResponse } from "../../utils/response.js";

/**
 * Get all languages with usage count
 */
export const adminGetLanguages = async (req, res, next) => {
  try {
    const languages = await prisma.language.findMany({
      orderBy: { englishName: "asc" },
      include: {
        _count: {
          select: { userPreferences: true },
        },
      },
    });

    return successResponse(res, "Languages fetched successfully", { languages });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single language by ID
 */
export const adminGetLanguageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const language = await prisma.language.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userPreferences: true },
        },
      },
    });

    if (!language) {
      return errorResponse(res, "Language not found", [], 404);
    }

    return successResponse(res, "Language fetched successfully", { language });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new language
 */
export const adminCreateLanguage = async (req, res, next) => {
  try {
    const { code, azureCode, englishName, nativeName, isActive } = req.body;

    if (!code || !englishName || !nativeName) {
      return errorResponse(
        res,
        "Language code, English name, and Native name are required.",
        [],
        400
      );
    }

    const normalizedCode = String(code).trim().toLowerCase();
    const normalizedAzureCode = azureCode ? String(azureCode).trim().toLowerCase() : normalizedCode;

    const existingCode = await prisma.language.findUnique({
      where: { code: normalizedCode },
    });

    if (existingCode) {
      return errorResponse(
        res,
        `Language with code '${normalizedCode}' already exists.`,
        [],
        400
      );
    }

    if (normalizedAzureCode) {
      const existingAzure = await prisma.language.findUnique({
        where: { azureCode: normalizedAzureCode },
      });
      if (existingAzure) {
        return errorResponse(
          res,
          `Language with Azure code '${normalizedAzureCode}' already exists.`,
          [],
          400
        );
      }
    }

    const language = await prisma.language.create({
      data: {
        code: normalizedCode,
        azureCode: normalizedAzureCode || null,
        englishName: String(englishName).trim(),
        nativeName: String(nativeName).trim(),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return successResponse(res, "Language created successfully", { language }, {}, 201);
  } catch (error) {
    if (error.code === "P2002") {
      return errorResponse(res, "Language code or Azure code must be unique.", [], 400);
    }
    next(error);
  }
};

/**
 * Update an existing language
 */
export const adminUpdateLanguage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, azureCode, englishName, nativeName, isActive } = req.body;

    const existing = await prisma.language.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse(res, "Language not found", [], 404);
    }

    const updateData = {};

    if (code !== undefined) {
      const normalizedCode = String(code).trim().toLowerCase();
      if (normalizedCode !== existing.code) {
        const duplicate = await prisma.language.findUnique({ where: { code: normalizedCode } });
        if (duplicate) {
          return errorResponse(res, `Language with code '${normalizedCode}' already exists.`, [], 400);
        }
      }
      updateData.code = normalizedCode;
    }

    if (azureCode !== undefined) {
      const normalizedAzure = azureCode ? String(azureCode).trim().toLowerCase() : null;
      if (normalizedAzure && normalizedAzure !== existing.azureCode) {
        const duplicateAzure = await prisma.language.findUnique({ where: { azureCode: normalizedAzure } });
        if (duplicateAzure) {
          return errorResponse(res, `Language with Azure code '${normalizedAzure}' already exists.`, [], 400);
        }
      }
      updateData.azureCode = normalizedAzure;
    }

    if (englishName !== undefined) {
      updateData.englishName = String(englishName).trim();
    }

    if (nativeName !== undefined) {
      updateData.nativeName = String(nativeName).trim();
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    const updated = await prisma.language.update({
      where: { id },
      data: updateData,
    });

    return successResponse(res, "Language updated successfully", { language: updated });
  } catch (error) {
    if (error.code === "P2002") {
      return errorResponse(res, "Language code or Azure code must be unique.", [], 400);
    }
    next(error);
  }
};

/**
 * Toggle active status of a language
 */
export const adminToggleLanguageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const language = await prisma.language.findUnique({ where: { id } });
    if (!language) {
      return errorResponse(res, "Language not found", [], 404);
    }

    const updated = await prisma.language.update({
      where: { id },
      data: { isActive: !language.isActive },
    });

    return successResponse(res, `Language ${updated.isActive ? "activated" : "deactivated"} successfully`, {
      language: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a language
 */
export const adminDeleteLanguage = async (req, res, next) => {
  try {
    const { id } = req.params;

    const language = await prisma.language.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userPreferences: true },
        },
      },
    });

    if (!language) {
      return errorResponse(res, "Language not found", [], 404);
    }

    // Default 'en' language should not be deleted
    if (language.code === "en") {
      return errorResponse(res, "Default system language (English) cannot be deleted.", [], 400);
    }

    // Check if user preferences exist
    if (language._count.userPreferences > 0) {
      return errorResponse(
        res,
        `Cannot delete language because ${language._count.userPreferences} user(s) are currently using it. Deactivate it instead.`,
        [],
        400
      );
    }

    await prisma.language.delete({ where: { id } });

    return successResponse(res, "Language deleted successfully");
  } catch (error) {
    next(error);
  }
};
