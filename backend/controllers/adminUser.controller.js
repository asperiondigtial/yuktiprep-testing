import prisma from "../config/prisma.js";
import {
  sendAccountLockedEmail,
  sendAccountRestoredEmail,
} from "../services/email.service.js";

/**
 * GET /api/v1/admin/users
 * Paginated list of users with search, active device counts, and lock status
 */
export async function getUsers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const search = req.query.search?.trim();
    const status = req.query.status; // "all" | "active" | "locked"

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status === "locked") {
      where.lockedAt = { not: null };
    } else if (status === "active") {
      where.active = true;
      where.lockedAt = null;
    } else if (status === "inactive") {
      where.active = false;
      where.lockedAt = null;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          role: true,
          active: true,
          examGroupId: true,
          examOptionId: true,
          examGroup: {
            select: { id: true, name: true, slug: true },
          },
          examOption: {
            select: { id: true, title: true },
          },
          lockedAt: true,
          lockedBy: true,
          lockReason: true,
          createdAt: true,
          _count: {
            select: {
              deviceSessions: {
                where: { revokedAt: null },
              },
            },
          },
        },
      }),
    ]);

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
      active: u.active,
      examGroupId: u.examGroupId,
      examOptionId: u.examOptionId,
      examGroupName: u.examGroup?.name || null,
      examOptionTitle: u.examOption?.title || null,
      locked: u.lockedAt !== null,
      lockedAt: u.lockedAt,
      lockedBy: u.lockedBy,
      lockReason: u.lockReason,
      activeDeviceCount: u._count?.deviceSessions || 0,
      createdAt: u.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        users: formatted,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/users/:userId
 * Single user details with lock details & active device list
 */
export async function getUserById(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        examGroup: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        examOption: {
          select: { id: true, title: true, logoUrl: true },
        },
        deviceSessions: {
          where: { revokedAt: null },
          orderBy: { lastActiveAt: "desc" },
          select: {
            id: true,
            deviceId: true,
            deviceName: true,
            deviceType: true,
            browser: true,
            operatingSystem: true,
            ipAddress: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let lockedByAdmin = null;
    if (user.lockedBy) {
      lockedByAdmin = await prisma.adminUser.findUnique({
        where: { id: user.lockedBy },
        select: { id: true, name: true, email: true },
      });
    }

    // Fetch AI metering summary
    let aiUsage = null;
    try {
      const { getUserDailyAiUsage } = await import("../services/metering.service.js");
      const quota = await getUserDailyAiUsage(userId);
      const requests = await prisma.meteringRequest.findMany({
        where: { userId },
        select: { actual: true, usageJson: true },
      });
      let totalTokens = 0;
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;
      let totalCostMicro = 0;
      for (const r of requests) {
        totalCostMicro += r.actual || 0;
        if (r.usageJson) {
          try {
            const u = JSON.parse(r.usageJson);
            totalPromptTokens += u.prompt_tokens || 0;
            totalCompletionTokens += u.completion_tokens || 0;
            totalTokens += u.total_tokens || ((u.prompt_tokens || 0) + (u.completion_tokens || 0));
          } catch (e) {}
        }
      }
      aiUsage = {
        quota,
        totalRequests: requests.length,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalCostRupees: Number((totalCostMicro / 1000000).toFixed(4)),
      };
    } catch (e) {
      console.error("Error computing user aiUsage:", e);
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        active: user.active,
        examGroupId: user.examGroupId,
        examOptionId: user.examOptionId,
        examGroup: user.examGroup,
        examOption: user.examOption,
        locked: user.lockedAt !== null,
        lockedAt: user.lockedAt,
        lockedBy: user.lockedBy,
        lockedByAdmin: lockedByAdmin ? lockedByAdmin.name : null,
        lockReason: user.lockReason,
        createdAt: user.createdAt,
        activeDeviceSessions: user.deviceSessions,
        aiUsage,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/users/:userId/lock
 * Atomically locks user, revokes all active device sessions, and records audit entry
 */
export async function lockUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const currentAdmin = req.admin;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        code: "REASON_REQUIRED",
        message: "A lock reason is required.",
      });
    }

    // Self-lock protection
    if (currentAdmin.id === userId) {
      return res.status(400).json({
        success: false,
        code: "CANNOT_LOCK_SELF",
        message: "You cannot lock your own account.",
      });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if already locked
    if (targetUser.lockedAt) {
      return res.status(400).json({
        success: false,
        code: "USER_ALREADY_LOCKED",
        message: "This user account is already locked.",
      });
    }

    const trimmedReason = reason.trim();
    const now = new Date();

    // Atomic transaction: lock user, revoke all active sessions, log action
    await prisma.$transaction(async (tx) => {
      // 1. Update user lock fields
      await tx.user.update({
        where: { id: userId },
        data: {
          lockedAt: now,
          lockedBy: currentAdmin.id,
          lockReason: trimmedReason,
        },
      });

      // 2. Revoke all active device sessions
      await tx.userDeviceSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          refreshTokenHash: null,
        },
      });

      // 3. Create audit action
      await tx.userAccountAction.create({
        data: {
          userId,
          adminId: currentAdmin.id,
          action: "LOCK",
          reason: trimmedReason,
          createdAt: now,
        },
      });
    });

    // Send async email notification post-commit
    if (targetUser.email) {
      sendAccountLockedEmail({
        email: targetUser.email,
        name: targetUser.name,
        reason: trimmedReason,
      }).catch((err) => {
        console.error("[Email Error] Failed to send lock notification:", err);
      });
    }

    return res.json({
      success: true,
      message: "User locked successfully. All active sessions have been revoked.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/admin/users/:userId/unlock
 * Unlocks user and records audit action (old sessions remain revoked)
 */
export async function unlockUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const currentAdmin = req.admin;

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Check if user is currently locked
    if (!targetUser.lockedAt) {
      return res.status(400).json({
        success: false,
        code: "USER_NOT_LOCKED",
        message: "This user account is not currently locked.",
      });
    }

    const trimmedReason = reason?.trim() || "Account restored by administrator";
    const now = new Date();

    // Atomic transaction: unlock user and record action
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          lockedAt: null,
          lockedBy: null,
          lockReason: null,
        },
      });

      await tx.userAccountAction.create({
        data: {
          userId,
          adminId: currentAdmin.id,
          action: "UNLOCK",
          reason: trimmedReason,
          createdAt: now,
        },
      });
    });

    // Send async email notification post-commit
    if (targetUser.email) {
      sendAccountRestoredEmail({
        email: targetUser.email,
        name: targetUser.name,
        reason: trimmedReason,
      }).catch((err) => {
        console.error("[Email Error] Failed to send unlock notification:", err);
      });
    }

    return res.json({
      success: true,
      message: "User restored successfully. The user can log in again.",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/admin/users/:userId/account-actions
 * Audit history of lock/unlock events for a user
 */
export async function getUserAccountActions(req, res, next) {
  try {
    const { userId } = req.params;

    const actions = await prisma.userAccountAction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        adminUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const formatted = actions.map((a) => ({
      id: a.id,
      action: a.action,
      adminId: a.adminId,
      adminName: a.adminUser?.name || "Administrator",
      adminEmail: a.adminUser?.email || null,
      reason: a.reason,
      createdAt: a.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        actions: formatted,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/admin/users/:userId
 * Permanently deletes a user and cascades deletion of all associated data.
 */
export async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    const currentAdmin = req.admin;

    // Safety: prevent self-deletion if an admin has user id
    if (currentAdmin && currentAdmin.id === userId) {
      return res.status(400).json({
        success: false,
        code: "CANNOT_DELETE_SELF",
        message: "You cannot delete your own account.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Execute atomic cleanup and user deletion
    await prisma.$transaction(async (tx) => {
      // 1. Delete community interactions
      await tx.communityNotification.deleteMany({
        where: { userId },
      });
      await tx.communityLike.deleteMany({
        where: { userId },
      });
      await tx.communityComment.deleteMany({
        where: { userId },
      });
      await tx.communityPost.deleteMany({
        where: { userId },
      });

      // 2. Delete mock test attempts
      await tx.mockTestAttempt.deleteMany({
        where: { userId },
      });

      // 3. Delete WhatsApp messages & conversations linked to this user
      await tx.whatsAppMessage.deleteMany({
        where: { userId },
      });
      await tx.whatsAppConversation.deleteMany({
        where: { userId },
      });

      // 4. Anonymize/unlink tickets so support audit records remain valid
      await tx.ticket.updateMany({
        where: { userId },
        data: { userId: null },
      });
      await tx.ticketEvent.updateMany({
        where: { actorUserId: userId },
        data: { actorUserId: null },
      });

      // 5. Clean up any OTP verifications for this user's phone number
      if (user.phoneNumber) {
        await tx.otpVerification.deleteMany({
          where: { phone: user.phoneNumber },
        });
      }

      // 6. Record admin audit log
      if (currentAdmin?.id) {
        await tx.auditLog.create({
          data: {
            adminUserId: currentAdmin.id,
            action: "DELETE_USER",
            entityType: "User",
            entityId: userId,
            oldData: {
              id: user.id,
              name: user.name,
              email: user.email,
              phoneNumber: user.phoneNumber,
            },
          },
        });
      }

      // 7. Finally, delete the User record.
      // This automatically cascades to:
      // - UserDeviceSession
      // - UserAccountAction
      // - UserLanguagePreference
      // - SavedJob
      // - LearnerProfile
      // - Subscription -> Payment
      // - Consent
      // - Session (interview) -> LearningEvent, Recording, Feedback
      // - StudyPlan -> StudyPlanMessage
      // - AiTutorSession -> AiTutorMessage
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return res.json({
      success: true,
      message: `User ${user.name || user.email || userId} and all associated data have been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
}
