import express from "express";
import { adminAuth } from "../../middleware/adminAuth.js";
import {
  adminGetLanguages,
  adminGetLanguageById,
  adminCreateLanguage,
  adminUpdateLanguage,
  adminToggleLanguageStatus,
  adminDeleteLanguage,
} from "../../controllers/admin/languages.controller.js";

const router = express.Router();

// Admin auth required for all language routes
router.use(adminAuth);

router.get("/", adminGetLanguages);
router.get("/:id", adminGetLanguageById);
router.post("/", adminCreateLanguage);
router.put("/:id", adminUpdateLanguage);
router.patch("/:id/toggle", adminToggleLanguageStatus);
router.delete("/:id", adminDeleteLanguage);

export default router;
