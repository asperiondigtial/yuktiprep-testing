import express from "express";
import { authMiddleware as adminAuth } from "../../middleware/auth.middleware.js";
import {
  getUsers,
  getUserById,
  lockUser,
  unlockUser,
  getUserAccountActions,
  deleteUser,
} from "../../controllers/adminUser.controller.js";

const router = express.Router();

// All routes require admin authentication
router.use(adminAuth);

router.get("/", getUsers);
router.get("/:userId", getUserById);
router.post("/:userId/lock", lockUser);
router.post("/:userId/unlock", unlockUser);
router.get("/:userId/account-actions", getUserAccountActions);
router.delete("/:userId", deleteUser);

export default router;
