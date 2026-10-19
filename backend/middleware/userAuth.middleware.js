import jwt from "jsonwebtoken";
import prisma from "../config/prisma.js";
import dotenv from "dotenv";

dotenv.config();

export const userAuthMiddleware = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      const admin = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
      });
      if (!admin) {
        return res
          .status(401)
          .json({ success: false, message: "User no longer exists" });
      }
      req.admin = admin;
      return next();
    }

    // Check if user is locked
    if (user.lockedAt) {
      return res.status(401).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: "Your account has been locked. Please contact support.",
      });
    }

    // If token includes sessionId, verify the device session is not revoked
    if (decoded.sessionId) {
      const session = await prisma.userDeviceSession.findUnique({
        where: { id: decoded.sessionId },
      });

      if (!session || session.revokedAt) {
        return res.status(401).json({
          success: false,
          code: "SESSION_REVOKED",
          message: "Session has been revoked or expired",
        });
      }
      req.sessionId = decoded.sessionId;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      let expiredIdentifier = "unknown";
      try {
        const decodedFallback = jwt.decode(token);
        if (decodedFallback && typeof decodedFallback === "object") {
          expiredIdentifier = decodedFallback.email || decodedFallback.phone || decodedFallback.id || "user";
        }
      } catch {}
      console.log(`[Auth] Token expired: ${expiredIdentifier}`);
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Token has expired",
      });
    }

    // Log actual unexpected errors only
    console.error("[Auth] Unexpected authentication error:", error.message || error);
    return res
      .status(401)
      .json({ success: false, message: "Not authorized to access this route" });
  }
};

export const optionalUserAuthMiddleware = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        languagePreference: {
          include: {
            language: true,
          },
        },
      },
    });

    if (!user) {
      const admin = await prisma.adminUser.findUnique({
        where: { id: decoded.id },
      });
      if (admin) {
        req.admin = admin;
      }
      return next();
    }

    req.user = user;
    next();
  } catch (error) {
    // If token invalid, proceed as guest without error
    next();
  }
};
