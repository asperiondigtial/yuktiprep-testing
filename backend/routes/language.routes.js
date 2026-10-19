import express from "express";
import { userAuthMiddleware, optionalUserAuthMiddleware } from "../middleware/userAuth.middleware.js";
import { getLanguages, getUserLanguage, updateUserLanguage, translateTextsController } from "../controllers/language.controller.js";

const router = express.Router();

router.get("/", optionalUserAuthMiddleware, getLanguages);
router.get("/languages", optionalUserAuthMiddleware, getLanguages);
router.get("/profile/language", userAuthMiddleware, getUserLanguage);
router.put("/profile/language", userAuthMiddleware, updateUserLanguage);
router.post("/translate", userAuthMiddleware, translateTextsController);

export default router;
