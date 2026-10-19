import { successResponse, errorResponse } from "../utils/response.js";
import prisma from "../config/prisma.js";
import { listLanguages, getUserLanguagePreference, updateUserLanguagePreference } from "../services/language.service.js";
import { translateTexts } from "../services/azureTranslator.service.js";
import { getUserPlanTier, PLAN_TIERS } from "../utils/planTier.js";

const FREE_ALLOWED_LANGUAGES = ["en"];
const BASIC_ALLOWED_LANGUAGES = ["en", "hi"];

const isLanguageAllowedForTier = (code, tier) => {
  const normalized = (code || "").toLowerCase();
  if (tier >= PLAN_TIERS.PREMIUM) return true;
  if (tier === PLAN_TIERS.BASIC) return BASIC_ALLOWED_LANGUAGES.includes(normalized);
  return FREE_ALLOWED_LANGUAGES.includes(normalized);
};

export const getLanguages = async (req, res, next) => {
  try {
    const allLanguages = await listLanguages();
    const planInfo = await getUserPlanTier(req.user?.id, prisma);
    const tier = planInfo.tier;

    // Filter languages based on user tier:
    // Free: only 'en'
    // Basic: 'en' and 'hi'
    // Premium: all languages
    const languages = allLanguages.filter((lang) =>
      isLanguageAllowedForTier(lang.code, tier)
    );

    successResponse(res, "Languages fetched successfully", {
      languages,
      userTier: planInfo.tierName,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserLanguage = async (req, res, next) => {
  try {
    const preference = await getUserLanguagePreference(req.user.id);
    successResponse(res, "Language preference fetched successfully", { preference });
  } catch (error) {
    next(error);
  }
};

export const updateUserLanguage = async (req, res, next) => {
  try {
    const { languageCode } = req.body;

    if (!languageCode) {
      return errorResponse(res, "Language code is required", [], 400);
    }

    const planInfo = await getUserPlanTier(req.user.id, prisma);
    const normalizedCode = languageCode.toLowerCase();

    if (!isLanguageAllowedForTier(normalizedCode, planInfo.tier)) {
      const requiredTier = planInfo.tier === PLAN_TIERS.FREE ? "BASIC" : "PREMIUM";
      return errorResponse(
        res,
        `Selected language requires an upgrade to ${requiredTier} tier`,
        [],
        403
      );
    }

    const language = await prisma.language.findUnique({
      where: { code: languageCode },
    });

    if (!language || !language.isActive) {
      return errorResponse(res, "Invalid language", [], 400);
    }

    const preference = await updateUserLanguagePreference(req.user.id, language.id);
    successResponse(res, "Language updated successfully", { preference });
  } catch (error) {
    next(error);
  }
};

export const translateTextsController = async (req, res, next) => {
  try {
    const { texts, targetLanguageCode } = req.body;

    if (!texts || !Array.isArray(texts) || !targetLanguageCode) {
      return errorResponse(res, "texts array and targetLanguageCode are required", [], 400);
    }

    const translatedTexts = await translateTexts(texts, targetLanguageCode);
    successResponse(res, "Texts translated successfully", { translatedTexts });
  } catch (error) {
    next(error);
  }
};
