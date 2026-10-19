import crypto from "crypto";
import prisma from "../config/prisma.js";
import { env } from "../config/env.js";
import { generateAccessToken } from "./auth.service.js";
import { sendEmail } from "../services/email.service.js";

/**
 * Parses user agent string to extract basic device & browser metadata.
 */
export function parseUserAgent(userAgent = "") {
  const ua = userAgent || "";
  let browser = "Unknown Browser";
  let operatingSystem = "Unknown OS";
  let deviceType = "desktop";
  let deviceName = "Unknown Device";

  // Operating system detection
  if (/windows/i.test(ua)) {
    operatingSystem = "Windows";
    deviceType = "desktop";
  } else if (/android/i.test(ua)) {
    operatingSystem = "Android";
    deviceType = "mobile";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    operatingSystem = /ipad/i.test(ua) ? "iPadOS" : "iOS";
    deviceType = /ipad/i.test(ua) ? "tablet" : "mobile";
  } else if (/macintosh|mac os x/i.test(ua)) {
    operatingSystem = "macOS";
    deviceType = "desktop";
  } else if (/linux/i.test(ua)) {
    operatingSystem = "Linux";
    deviceType = "desktop";
  }

  // Browser detection
  if (/edg\//i.test(ua)) {
    browser = "Edge";
  } else if (/opr\/|opera/i.test(ua)) {
    browser = "Opera";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = "Safari";
  }

  // Friendly Device Name
  if (deviceType === "mobile" || deviceType === "tablet") {
    if (operatingSystem === "iOS") deviceName = "iPhone";
    else if (operatingSystem === "iPadOS") deviceName = "iPad";
    else if (operatingSystem === "Android") deviceName = "Android Device";
    else deviceName = "Mobile Device";
  } else {
    deviceName = `${operatingSystem} Computer`;
  }

  return {
    deviceName,
    deviceType,
    browser,
    operatingSystem,
  };
}

/**
 * Generate a cryptographically secure random refresh token (hex string)
 */
export function generateRawRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

/**
 * Hash raw refresh token with sha256 before saving in database
 */
export function hashRefreshToken(rawToken) {
  return crypto.createHash("sha512").update(rawToken).digest("hex");
}

/**
 * Calculate Refresh Token Expiry Date based on JWT_REFRESH_EXPIRES_IN (default: 30d)
 */
export function getRefreshTokenExpiry() {
  const refreshExp = env.JWT_REFRESH_EXPIRES_IN || "30d";
  let days = 30;
  if (refreshExp.endsWith("d")) {
    days = parseInt(refreshExp.replace("d", ""), 10) || 30;
  }
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Sends a security notification email for new-device login and multi-device alerts (when total active >= 2).
 */
export async function sendNewDeviceEmail({
  email,
  name,
  session,
  ipAddress,
  totalActive = 1,
}) {
  if (!email) return;

  const loginTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isMultiple = totalActive >= 2;
  const subject = isMultiple
    ? `Security Alert: Active devices on your YuktiPrep account reached ${totalActive}/3`
    : "Security Alert: New Device Login to Your YuktiPrep Account";

  const multiDeviceBanner = isMultiple
    ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; color: #92400e;">
        <strong>Multi-device Notice:</strong> You now have <strong>${totalActive} active devices</strong> logged in (maximum allowed: 3). If any of these are unfamiliar, you can log them out in your settings.
      </div>
    `
    : "";

  const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
  // Bulletproof, high-availability CDN icons with fallback styling for email clients
  const igIconUrl = "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
  const fbIconUrl = "https://cdn-icons-png.flaticon.com/512/733/733547.png";

  const html = `
   <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-collapse: collapse; border: 1px solid #e2e8f0;">
        <!-- Teal Header -->
        <tr>
          <td style="padding: 28px 24px 20px; text-align: center;">
            <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="https://ci3.googleusercontent.com/meips/ADKq_NZlErDJVGAGw5CjpUuuLsKC7eaIl2ZydXpp3PswAofksVzLFTGwpwXl2_Dsf7Treoujxu9uYkuhcrBaP-Q=s0-d-e1-ft#https://www.yuktiprep.com/yuktiprep.png" alt="YuktiPrep" height="64" style="height: 64px; max-height: 64px; width: auto; border: 0; display: block; margin: 0 auto 16px auto;" />
            </a>
            <div style="padding: 0;">
              <h1 style="color: #0f172a; margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.3px;">YuktiPrep Security Alert</h1>
            </div>
            
          </td>
        </tr>

        <!-- Main Body (White Background) -->
        <tr>
          <td style="padding: 4px 28px 28px; color: #334155; line-height: 1.6; background-color: #ffffff;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${name || "there"},</p>
            <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
              A new device was recently used to log in to your YuktiPrep account.
            </p>

            ${multiDeviceBanner}

            <!-- Device Info Card in Light Teal Tint -->
            <div style="background: #ffffff; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 10px 0; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500; width: 42%;">Device:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${session.deviceName || "Unknown"} (${session.deviceType || "desktop"})</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Browser:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${session.browser || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Operating System:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${session.operatingSystem || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Login Time:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${loginTime} (IST)</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500;">IP Address:</td>
                  <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${ipAddress || "Unknown"}</td>
                </tr>
                <tr>
                  <td style="padding: 7px 0; color: #64748b; font-weight: 500;">Total Active Devices:</td>
                  <td style="padding: 8px 0; font-weight: 500; color: #0d9488;">${totalActive} / 1</td>
                </tr>
              </table>
            </div>

            <p style="font-size: 14px; color: #64748b; margin-top: 16px;">
              If this was you, you can safely ignore this email.
            </p>
            <p style="font-size: 14px; color: #475569; font-weight: 400; background: #ffffff; border-left: 2px solid #cbd5e1; padding: 4px 0 4px 12px; margin-bottom: 0;">
              If you don't recognize this login, please go to <strong>Profile &rarr; Settings &rarr; Devices</strong> to log out the device immediately, and update your credentials.
            </p>
          </td>
        </tr>

        <!-- Teal & White Footer with Social Links -->
        <tr>
          <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
              Connect with YuktiPrep
            </p>
            
            <!-- Social Media Icons (Instagram & Facebook) -->
            <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px auto;">
              <tr>
                <td style="padding: 0 10px;">
                  <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
                    <img src="${igIconUrl}" alt="Instagram" width="28" height="28" style="display: block; width: 28px; height: 28px; border: 0;" />
                  </a>
                </td>
                <td style="padding: 0 10px;">
                  <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none; display: inline-block;">
                    <img src="${fbIconUrl}" alt="Facebook" width="28" height="28" style="display: block; width: 28px; height: 28px; border: 0;" />
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin: 0 0 6px 0; font-size: 13px;">
              <a href="https://www.yuktiprep.com" target="_blank" style="color: #0d9488; text-decoration: none; font-weight: 600;">www.yuktiprep.com</a>
            </p>
            <p style="margin: 0; font-size: 11px; color: #94a3b8;">
              &copy; ${new Date().getFullYear()} YuktiPrep. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject,
    html,
    text: `New device login detected: ${session.deviceName || "Device"} (${session.browser}, ${session.operatingSystem}) on ${loginTime} from IP ${ipAddress}. Total active devices: ${totalActive}/3. If this wasn't you, review your active sessions in Profile -> Settings -> Devices.`,
  });
}

/**
 * Handle user device session creation/reuse with transaction row-locking
 * to strictly enforce SINGLE ACTIVE DEVICE per user (auto-logout previous devices).
 */
export async function handleUserDeviceSession({
  userId,
  user,
  deviceId,
  ipAddress,
  userAgent,
}) {
  const rawRefreshToken = generateRawRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = getRefreshTokenExpiry();

  const uaParsed = parseUserAgent(userAgent);

  const result = await prisma.$transaction(async (tx) => {
    // Acquire a row-level lock on the User record to serialize logins for this user
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

    // 1. Revoke ALL previous active sessions for this user across all devices
    await tx.userDeviceSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        refreshTokenHash: null,
      },
    });

    // 2. Check if session already exists for this device
    const existingSession = await tx.userDeviceSession.findUnique({
      where: {
        userId_deviceId: {
          userId,
          deviceId,
        },
      },
    });

    let session;
    if (existingSession) {
      // Reactivate and update existing session for this device
      session = await tx.userDeviceSession.update({
        where: { id: existingSession.id },
        data: {
          refreshTokenHash,
          expiresAt,
          revokedAt: null, // Reactivate as the single active session
          lastActiveAt: new Date(),
          ipAddress: ipAddress || existingSession.ipAddress,
          userAgent: userAgent || existingSession.userAgent,
          deviceName: uaParsed.deviceName || existingSession.deviceName,
          deviceType: uaParsed.deviceType || existingSession.deviceType,
          browser: uaParsed.browser || existingSession.browser,
          operatingSystem:
            uaParsed.operatingSystem || existingSession.operatingSystem,
        },
      });
    } else {
      // Create new device session record
      session = await tx.userDeviceSession.create({
        data: {
          userId,
          deviceId,
          refreshTokenHash,
          expiresAt,
          lastActiveAt: new Date(),
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          deviceName: uaParsed.deviceName,
          deviceType: uaParsed.deviceType,
          browser: uaParsed.browser,
          operatingSystem: uaParsed.operatingSystem,
        },
      });
    }

    return {
      session,
      isNewDevice: !existingSession,
      totalActive: 1,
    };
  });

  // Issue Access Token with active sessionId
  const accessToken = generateAccessToken({
    id: userId,
    sub: userId,
    sessionId: result.session.id,
    phone: user?.phoneNumber,
    email: user?.email,
  });

  // Real-time notification to kick previous device if connected via Socket.IO
  try {
    const { getIO } = await import("../socket.js");
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit("auth:session_revoked", {
        newSessionId: result.session.id,
        message: "You have been logged out because your account was logged in on another device.",
      });
    }
  } catch (socketErr) {
    // Non-blocking socket broadcast
  }

  // If a new device logged in, dispatch security email asynchronously
  if (result.isNewDevice && user?.email) {
    sendNewDeviceEmail({
      email: user.email,
      name: user.name,
      session: result.session,
      ipAddress,
      totalActive: 1,
    }).catch((err) => {
      console.error("[DeviceSession] Error sending new device email:", err);
    });
  }

  return {
    accessToken,
    rawRefreshToken,
    session: result.session,
    isNewDevice: result.isNewDevice,
    totalActive: 1,
  };
}

/**
 * Rotate refresh token and issue new access token.
 * Detects reuse of old tokens to prevent replay attacks.
 */
export async function refreshDeviceToken({
  rawRefreshToken,
  ipAddress,
  userAgent,
}) {
  if (!rawRefreshToken) {
    const error = new Error("Refresh token is required");
    error.code = "INVALID_REFRESH_TOKEN";
    error.status = 401;
    throw error;
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.userDeviceSession.findFirst({
    where: {
      refreshTokenHash: tokenHash,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    const error = new Error("Invalid or expired refresh token");
    error.code = "INVALID_REFRESH_TOKEN";
    error.status = 401;
    throw error;
  }

  // Check if user account is locked
  if (session.user?.lockedAt) {
    const error = new Error("Your account has been locked. Please contact support.");
    error.code = "ACCOUNT_LOCKED";
    error.status = 401;
    throw error;
  }

  // Check if session is revoked
  if (session.revokedAt) {
    const error = new Error("Session has been revoked");
    error.code = "SESSION_REVOKED";
    error.status = 401;
    throw error;
  }

  // Check if expired
  if (session.expiresAt && new Date() > session.expiresAt) {
    await prisma.userDeviceSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), refreshTokenHash: null },
    });
    const error = new Error("Refresh token expired");
    error.code = "REFRESH_TOKEN_EXPIRED";
    error.status = 401;
    throw error;
  }

  // Generate new rotated refresh token
  const newRawRefreshToken = generateRawRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRawRefreshToken);
  const newExpiresAt = getRefreshTokenExpiry();

  const uaParsed = userAgent ? parseUserAgent(userAgent) : {};

  // Update session with new hash and activity
  await prisma.userDeviceSession.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt: newExpiresAt,
      lastActiveAt: new Date(),
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
      ...(uaParsed.browser ? { browser: uaParsed.browser } : {}),
      ...(uaParsed.operatingSystem
        ? { operatingSystem: uaParsed.operatingSystem }
        : {}),
    },
  });

  // Issue new access token
  const newAccessToken = generateAccessToken({
    id: session.userId,
    sub: session.userId,
    sessionId: session.id,
    phone: session.user.phoneNumber,
    email: session.user.email,
  });

  return {
    accessToken: newAccessToken,
    rawRefreshToken: newRawRefreshToken,
    session,
  };
}

/**
 * Revoke a single session by ID ensuring ownership by authenticated user
 */
export async function revokeSession({ userId, sessionId }) {
  const session = await prisma.userDeviceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) {
    const error = new Error("Device session not found");
    error.code = "DEVICE_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  await prisma.userDeviceSession.update({
    where: { id: sessionId },
    data: {
      revokedAt: new Date(),
      refreshTokenHash: null,
    },
  });

  return true;
}

/**
 * Revoke all other active sessions for user except current
 */
export async function revokeOtherSessions({ userId, currentSessionId }) {
  await prisma.userDeviceSession.updateMany({
    where: {
      userId,
      id: { not: currentSessionId },
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      refreshTokenHash: null,
    },
  });

  return true;
}

/**
 * Revoke all active sessions for user
 */
export async function revokeAllSessions({ userId }) {
  await prisma.userDeviceSession.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      refreshTokenHash: null,
    },
  });

  return true;
}

/**
 * Get all active sessions for a user
 */
export async function getUserDeviceSessions({ userId, currentSessionId }) {
  const sessions = await prisma.userDeviceSession.findMany({
    where: {
      userId,
      revokedAt: null,
    },
    orderBy: {
      lastActiveAt: "desc",
    },
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
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName || "Unknown Device",
    deviceType: s.deviceType || "desktop",
    browser: s.browser || "Unknown Browser",
    operatingSystem: s.operatingSystem || "Unknown OS",
    ipAddress: s.ipAddress,
    lastActiveAt: s.lastActiveAt,
    createdAt: s.createdAt,
    current: currentSessionId ? s.id === currentSessionId : false,
  }));
}
