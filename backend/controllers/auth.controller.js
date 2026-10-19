import prisma from "../config/prisma.js";
// import { sendOTP } from "../utils/email.js";
import * as authService from "../services/auth.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import * as otpService from "../services/otp.service.js";
import { sendSms } from "../services/sms.service.js";
import * as deviceSessionService from "../services/deviceSession.service.js";
import { sendEmail } from "../services/email.service.js";
import { ensureUserFreeSubscription } from "../services/subscription.service.js";
import {
  validateEmailAddress,
  maskEmail,
} from "../services/disposableEmail.service.js";

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// OLD EMAIL OTP FLOW - PRESERVED FOR REFERENCE
/*
export const registerWithOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return errorResponse(res, "Email is required", [], 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse(res, "User already exists with this email", [], 400);
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { email },
    });
    if (existingOtp) {
      await prisma.otpVerification.update({
        where: { id: existingOtp.id },
        data: { otpCode: otp, expiresAt, verified: false },
      });
    } else {
      await prisma.otpVerification.create({
        data: { email, otpCode: otp, expiresAt },
      });
    }

    await sendOTP(email, otp);
    successResponse(res, "OTP sent successfully to email");
  } catch (error) {
    next(error);
  }
};
*/

// Phone-based registration
export const registerSendOtp = async (req, res, next) => {
  try {
    const {
      phone,
      name,
      email,
      channel,
      targetExamId,
      attemptYear,
      studyHoursPerDay,
      preferredLanguage,
    } = req.body;

    if (!phone) {
      return errorResponse(res, "Phone number is required", [], 400);
    }

    if (!email) {
      return errorResponse(res, "Email is required", [], 400);
    }

    const normalizedPhone = otpService.normalizePhone(phone);
    const normalizedEmail = String(email).trim().toLowerCase();

    const emailValidation = await validateEmailAddress(normalizedEmail);
    if (!emailValidation.valid) {
      return errorResponse(
        res,
        emailValidation.message,
        [{ field: "email", message: emailValidation.message }],
        400,
      );
    }

    const [existingPhone, existingEmail] = await Promise.all([
      prisma.user.findFirst({
        where: { phoneNumber: normalizedPhone },
      }),
      prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      }),
    ]);

    const errors = [];
    if (existingPhone) {
      errors.push({ field: "phone", message: "Phone number is already registered" });
    }
    if (existingEmail) {
      errors.push({ field: "email", message: "Email is already registered" });
    }

    if (errors.length > 0) {
      const mainMessage = errors.map((e) => e.message).join(" & ");
      return errorResponse(res, mainMessage, errors, 400);
    }

    const otp = generateOTP();
    const expiresAt = otpService.getOtpExpiry();
    const otpHash = otpService.hashOtp(otp);
    console.log(
      "register phone:",
      phone,
      "email:",
      normalizedEmail,
      "otp:",
      otp,
      "channel:",
      channel,
    );

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { phone: normalizedPhone, purpose: "REGISTER", verified: false },
    });

    if (existingOtp) {
      await prisma.otpVerification.update({
        where: { id: existingOtp.id },
        data: { otpHash, expiresAt, attempts: 0 },
      });
    } else {
      await prisma.otpVerification.create({
        data: {
          phone: normalizedPhone,
          purpose: "REGISTER",
          otpHash,
          expiresAt,
        },
      });
    }

    const targetChannel = channel === "sms" ? "sms" : "email";

    if (targetChannel === "email") {
      try {
        const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
        const igIconUrl =
          "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
        const fbIconUrl =
          "https://cdn-icons-png.flaticon.com/512/733/733547.png";

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc !important;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff !important; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <tr>
                <td style="padding: 28px 28px 24px; text-align: center;">
                  <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
                    <img src="${logoUrl}" alt="YuktiPrep" height="80" style="height: 80px; max-height: 80px; width: auto; border: 0; display: block; margin: 0 auto 12px auto;" />
                  </a>
                  <div style="padding: 8px 0 0;">
                    <h1 style="color: #0f172a; margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.3px;">Welcome to YuktiPrep</h1>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 28px 28px; color: #334155; line-height: 1.6; background-color: #ffffff;">
                  <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${name || "there"},</p>
                  <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
                    Thank you for signing up with YuktiPrep! Your one-time verification code is:
                  </p>

                  <div style="background: #f8fafc; border-radius: 6px; padding: 20px; margin: 22px 0; text-align: center;">
                    <span style="display: inline-block; font-size: 32px; font-weight: 600; letter-spacing: 7px; color: #0f766e; background: #ffffff; padding: 10px 22px; border-radius: 4px;">
                      ${otp}
                    </span>
                    <p style="margin: 12px 0 0 0; font-size: 13px; color: #0d9488; font-weight: 600;">
                      Valid for 10 minutes &bull; Do not share with anyone
                    </p>
                  </div>

                  <p style="font-size: 14px; color: #64748b; margin: 16px 0 0 0;">
                    If you did not request this registration code, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
                  <p style="margin: 0 0 14px 0; font-size: 13px; color: #0f766e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Connect with YuktiPrep
                  </p>
                  <table align="center" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 16px auto;">
                    <tr>
                      <td style="padding: 0 10px;">
                        <a href="https://www.instagram.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                          <img src="${igIconUrl}" alt="Instagram" width="28" height="28" style="display: block; width: 28px; height: 28px; border: 0;" />
                        </a>
                      </td>
                      <td style="padding: 0 10px;">
                        <a href="https://www.facebook.com/yuktiprep/" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
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
          subject: `${otp} is your YuktiPrep registration code`,
          html: emailHtml,
          text: `Your YuktiPrep registration verification code is ${otp}. Valid for 10 minutes.`,
        });

        return successResponse(res, "Registration OTP sent to your email", {
          channel: "email",
          maskedEmail: maskEmail(email),
        });
      } catch (emailError) {
        console.error(
          "Failed to send register email OTP, falling back to SMS:",
          emailError,
        );
      }
    }

    // SMS Delivery (when channel === 'sms' or email sending failed)
    try {
      await sendSms(phone, otp);
      return successResponse(res, "OTP sent to your phone via SMS", {
        channel: "sms",
      });
    } catch (smsError) {
      return errorResponse(
        res,
        "Failed to send OTP. Please try again later.",
        [],
        500,
      );
    }
  } catch (error) {
    next(error);
  }
};

export const registerVerifyOtp = async (req, res, next) => {
  try {
    const {
      phone,
      otp,
      email,
      name,
      targetExamId,
      attemptYear,
      studyHoursPerDay,
      preferredLanguage,
    } = req.body;

    if (!phone || !otp || !email || !name) {
      return errorResponse(
        res,
        "Phone number, email, name, and OTP are required",
        [],
        400,
      );
    }

    const normalizedPhone = otpService.normalizePhone(phone);
    const normalizedEmail = String(email).trim().toLowerCase();

    const emailValidation = await validateEmailAddress(normalizedEmail);
    if (!emailValidation.valid) {
      return errorResponse(
        res,
        emailValidation.message,
        [{ field: "email", message: emailValidation.message }],
        400,
      );
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { phone: normalizedPhone, purpose: "REGISTER", verified: false },
    });

    if (!otpRecord) {
      return errorResponse(res, "Invalid OTP", [], 400);
    }

    if (otpRecord.attempts >= otpService.getMaxAttempts()) {
      return errorResponse(
        res,
        "Too many failed attempts. Please request a new OTP.",
        [],
        400,
      );
    }

    if (otpService.isOtpExpired(otpRecord.expiresAt)) {
      return errorResponse(res, "OTP has expired", [], 400);
    }

    if (!otpService.verifyOtpHash(otp, otpRecord.otpHash)) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return errorResponse(res, "Invalid OTP", [], 400);
    }

    const [isPhoneAlready, isEmailAlready] = await Promise.all([
      prisma.user.findFirst({
        where: { phoneNumber: normalizedPhone },
      }),
      prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      }),
    ]);

    const errors = [];
    if (isPhoneAlready) {
      errors.push({ field: "phone", message: "Phone number is already registered" });
    }
    if (isEmailAlready) {
      errors.push({ field: "email", message: "Email is already registered" });
    }

    if (errors.length > 0) {
      const mainMessage = errors.map((e) => e.message).join(" & ");
      return errorResponse(res, mainMessage, errors, 400);
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true, verifiedAt: new Date() },
    });

    const user = await prisma.user.create({
      data: {
        phoneNumber: normalizedPhone,
        email: normalizedEmail,
        name: String(name).trim(),
        isVerified: true,
        active: false,
        examGroupId: null,
        examOptionId: null,
        learnerProfile: {
          create: {
            targetExamId,
            attemptYear: attemptYear ? parseInt(attemptYear) : undefined,
            studyHoursPerDay: studyHoursPerDay
              ? parseFloat(studyHoursPerDay)
              : undefined,
            preferredLanguage: preferredLanguage || "en",
          },
        },
      },
      include: {
        learnerProfile: true,
        subscriptions: {
          where: { status: { not: "cancelled" } },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    await prisma.otpVerification.delete({ where: { id: otpRecord.id } });

    // Automatically apply Free plan to every new user
    const freeSub = await ensureUserFreeSubscription(user.id);
    if (freeSub) {
      user.subscriptions = [freeSub];
    }

    // Device session and token issuance
    const clientDeviceId =
      req.body.deviceId || req.headers["x-device-id"] || "default-device";
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip;
    const userAgent = req.headers["user-agent"] || "";

    const sessionResult = await deviceSessionService.handleUserDeviceSession({
      userId: user.id,
      user,
      deviceId: clientDeviceId,
      ipAddress,
      userAgent,
    });

    const { accessToken, rawRefreshToken } = sessionResult;

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    res.cookie("token", accessToken, {
      httpOnly: false, // allow client-side cookie reading across *.yuktiprep.com
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    successResponse(
      res,
      "User registered successfully",
      { token: accessToken, refreshToken: rawRefreshToken, user },
      {},
      201,
    );
  } catch (error) {
    if (error.code === "P2002" && error.meta?.target?.includes("phoneNumber")) {
      return errorResponse(res, "Phone number is already registered", [], 400);
    }
    if (error.code === "P2002" && error.meta?.target?.includes("email")) {
      return errorResponse(res, "Email is already registered", [], 400);
    }
    next(error);
  }
};

// OLD EMAIL OTP FLOW - PRESERVED FOR REFERENCE
/*
export const loginWithOTP = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, "Email is required", [], 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse(
        res,
        "User not found. Please register first.",
        [],
        404,
      );
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { email },
    });
    if (existingOtp) {
      await prisma.otpVerification.update({
        where: { id: existingOtp.id },
        data: { otpCode: otp, expiresAt, verified: false },
      });
    } else {
      await prisma.otpVerification.create({
        data: { email, otpCode: otp, expiresAt },
      });
    }

    await sendOTP(email, otp);
    successResponse(res, "Login OTP sent to your email");
  } catch (error) {
    next(error);
  }
};
*/

// Phone-based login (Email-first with optional SMS fallback)
export const loginSendOtp = async (req, res, next) => {
  try {
    const { phone, channel } = req.body;
    // Default to 'email', allow 'sms' if requested
    const targetChannel = channel === "sms" ? "sms" : "email";

    if (!phone) {
      return errorResponse(res, "Phone number is required", [], 400);
    }

    const normalizedPhone = otpService.normalizePhone(phone);

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
    });
    if (!user) {
      return errorResponse(
        res,
        "User not found. Please register first.",
        [],
        404,
      );
    }

    const otp = generateOTP();
    const expiresAt = otpService.getOtpExpiry();
    const otpHash = otpService.hashOtp(otp);

    const existingOtp = await prisma.otpVerification.findFirst({
      where: { phone: normalizedPhone, purpose: "LOGIN", verified: false },
    });

    if (existingOtp) {
      await prisma.otpVerification.update({
        where: { id: existingOtp.id },
        data: { otpHash, expiresAt, attempts: 0 },
      });
    } else {
      await prisma.otpVerification.create({
        data: { phone: normalizedPhone, purpose: "LOGIN", otpHash, expiresAt },
      });
    }

    // Helper to mask email (e.g. k***r@gmail.com)
    const maskEmail = (email) => {
      if (!email || !email.includes("@")) return "";
      const [name, domain] = email.split("@");
      if (name.length <= 2) return `${name[0]}*@${domain}`;
      return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
    };

    // If channel is email and user has email configured
    if (targetChannel === "email" && user.email) {
      try {
        console.log("login email:", user.email, "login otp:", otp);
        const logoUrl = "https://www.yuktiprep.com/yuktiprep.png";
        const igIconUrl =
          "https://cdn-icons-png.flaticon.com/512/2111/2111463.png";
        const fbIconUrl =
          "https://cdn-icons-png.flaticon.com/512/733/733547.png";

        const emailHtml = `
           <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f8fafc !important;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff !important; border-collapse: collapse;">
              <!-- Teal Header -->
              <tr>
          <td style="padding: 28px 28px 24px; text-align: center;">
            <a href="https://www.yuktiprep.com" target="_blank" style="text-decoration: none; display: inline-block;">
              <img src="${logoUrl}" alt="YuktiPrep" height="80" style="height: 80px; max-height: 80px; width: auto; border: 0; display: block; margin: 0 auto 12px auto;" />
            </a>
            <div style="padding: 8px 0 0;">
              <h1 style="color: #0f172a; margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -0.3px;">YuktiPrep Login Verification</h1>
            </div>
            
          </td>
        </tr>
              <!-- Main Body (White Background) -->
              <tr>
                <td style="padding: 4px 28px 28px; color: #334155; line-height: 1.6; background-color: #ffffff;">
                  <p style="font-size: 16px; margin: 0 0 12px 0; color: #0f172a; font-weight: 600;">Hello ${user.name || "there"},</p>
                  <p style="font-size: 15px; color: #475569; margin: 0 0 16px 0;">
                    Your one-time login verification code for YuktiPrep is:
                  </p>

                  <!-- OTP Display Card -->
                  <div style="background: #f8fafc; border-radius: 6px; padding: 20px; margin: 22px 0; text-align: center;">
                    <span style="display: inline-block; font-size: 32px; font-weight: 600; letter-spacing: 7px; color: #0f766e; background: #ffffff; padding: 10px 22px; border-radius: 4px;">
                      ${otp}
                    </span>
                    <p style="margin: 12px 0 0 0; font-size: 13px; color: #0d9488; font-weight: 600;">
                      Valid for 10 minutes &bull; Do not share with anyone
                    </p>
                  </div>

                  <p style="font-size: 14px; color: #64748b; margin: 16px 0 0 0;">
                    If you did not request this login code, you can safely ignore this email or review your active devices in <strong>Profile &rarr; Settings &rarr; Devices</strong>.
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
          to: user.email,
          subject: `${otp} is your YuktiPrep verification code`,
          html: emailHtml,
          text: `Your YuktiPrep login verification code is ${otp}. Valid for 10 minutes.`,
        });

        return successResponse(res, "Login OTP sent to your registered email", {
          channel: "email",
          maskedEmail: maskEmail(user.email),
        });
      } catch (emailError) {
        console.error(
          "Failed to send login email OTP, falling back to SMS:",
          emailError,
        );
        // Fallback to SMS if email fails
      }
    }

    // SMS channel or email fallback
    try {
      console.log("login phone via SMS:", phone, "login otp:", otp);
      await sendSms(phone, otp);
    } catch (smsError) {
      return errorResponse(
        res,
        "Failed to send OTP. Please try again later.",
        [],
        500,
      );
    }

    return successResponse(res, "Login OTP sent to your phone via SMS", {
      channel: "sms",
    });
  } catch (error) {
    next(error);
  }
};

export const loginVerifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return errorResponse(res, "Phone number and OTP are required", [], 400);
    }

    const normalizedPhone = otpService.normalizePhone(phone);

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { phone: normalizedPhone, purpose: "LOGIN", verified: false },
    });

    if (!otpRecord) {
      return errorResponse(res, "Invalid OTP", [], 400);
    }

    if (otpRecord.attempts >= otpService.getMaxAttempts()) {
      return errorResponse(
        res,
        "Too many failed attempts. Please request a new OTP.",
        [],
        400,
      );
    }

    if (otpService.isOtpExpired(otpRecord.expiresAt)) {
      return errorResponse(res, "OTP has expired", [], 400);
    }

    if (!otpService.verifyOtpHash(otp, otpRecord.otpHash)) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 },
      });
      return errorResponse(res, "Invalid OTP", [], 400);
    }

    const user = await prisma.user.findUnique({
      where: { phoneNumber: normalizedPhone },
      include: {
        learnerProfile: true,
        subscriptions: {
          where: { status: { not: "cancelled" } },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return errorResponse(res, "User not found", [], 404);
    }

    // Automatically apply Free plan if user doesn't have an active subscription
    if (!user.subscriptions || user.subscriptions.length === 0) {
      const freeSub = await ensureUserFreeSubscription(user.id);
      if (freeSub) {
        user.subscriptions = [freeSub];
      }
    }

    // Check if account is locked
    if (user.lockedAt) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_LOCKED",
        message: "Your account has been locked. Please contact support.",
      });
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true, verifiedAt: new Date() },
    });

    await prisma.otpVerification.delete({ where: { id: otpRecord.id } });

    // Device session and token issuance
    const clientDeviceId =
      req.body.deviceId || req.headers["x-device-id"] || "default-device";
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip;
    const userAgent = req.headers["user-agent"] || "";

    let sessionResult;
    try {
      sessionResult = await deviceSessionService.handleUserDeviceSession({
        userId: user.id,
        user,
        deviceId: clientDeviceId,
        ipAddress,
        userAgent,
      });
    } catch (sessionError) {
      if (sessionError.code === "MAX_DEVICES_REACHED") {
        return res.status(409).json({
          success: false,
          code: "MAX_DEVICES_REACHED",
          message:
            "Maximum devices logged in. Logout another device and login on this device.",
        });
      }
      throw sessionError;
    }

    const { accessToken, rawRefreshToken, session } = sessionResult;

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    // Legacy/Web Token Cookie (for backward compatibility with client cookie reading)
    res.cookie("token", accessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 15 * 60 * 1000, // 15 mins for access token
    });

    // Secure HttpOnly Refresh Token Cookie
    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    successResponse(res, "Logged in successfully", {
      token: accessToken,
      refreshToken: rawRefreshToken,
      user,
      sessionId: session.id,
    });
  } catch (error) {
    next(error);
  }
};

// OLD EMAIL OTP FLOW - PRESERVED FOR REFERENCE
/*
export const verifyOTP = async (req, res, next) => {
  try {
    const {
      email,
      otp,
      phoneNumber,
      name,
      targetExamId,
      attemptYear,
      studyHoursPerDay,
      preferredLanguage,
    } = req.body;

    if (!email || !otp) {
      return errorResponse(res, "Email and OTP are required", [], 400);
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email, otpCode: otp },
    });
    if (!otpRecord) {
      return errorResponse(res, "Invalid OTP", [], 400);
    }

    if (new Date() > otpRecord.expiresAt) {
      return errorResponse(res, "OTP has expired", [], 400);
    }

    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    });

    const user = await prisma.user.create({
      data: {
        email,
        phoneNumber,
        name,
        isVerified: true,
        learnerProfile: {
          create: {
            targetExamId,
            attemptYear,
            studyHoursPerDay,
            preferredLanguage,
          },
        },
      },
      include: { learnerProfile: true, subscriptions: { where: { status: { not: "cancelled" } }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });

    await prisma.otpVerification.delete({ where: { id: otpRecord.id } });

    const token = authService.generateToken({ id: user.id, email: user.email });

    successResponse(
      res,
      "User registered successfully",
      { token, user },
      {},
      201,
    );
  } catch (error) {
    if (error.code === "P2002" && error.meta?.target?.includes("phoneNumber")) {
      return errorResponse(res, "Phone number is already registered", [], 400);
    }
    next(error);
  }
};
*/

// OLD EMAIL OTP FLOW - PRESERVED FOR REFERENCE
/*
export const verifyLoginOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return errorResponse(res, "Email and OTP are required", [], 400);
    }

    const otpRecord = await prisma.otpVerification.findFirst({
      where: { email, otpCode: otp },
    });
    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      return errorResponse(res, "Invalid or expired OTP", [], 400);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { learnerProfile: true, subscriptions: { where: { status: { not: "cancelled" } }, include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!user) {
      return errorResponse(res, "User not found", [], 404);
    }

    await prisma.otpVerification.delete({ where: { id: otpRecord.id } });

    const token = authService.generateToken({ id: user.id, email: user.email });
    successResponse(res, "Logged in successfully", { token, user });
  } catch (error) {
    next(error);
  }
};
*/

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, "Email and password are required", [], 400);
    }

    const admin = await authService.findAdminByEmail(email);
    if (!admin) {
      return errorResponse(res, "Invalid credentials", [], 401);
    }

    if (!admin.isActive) {
      return errorResponse(res, "Account is disabled", [], 403);
    }

    const isMatch = await authService.comparePassword(
      password,
      admin.passwordHash,
    );
    if (!isMatch) {
      return errorResponse(res, "Invalid credentials", [], 401);
    }

    await authService.updateLastLogin(admin.id);

    const token = authService.generateToken({ id: admin.id, role: admin.role });

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 24 * 60 * 60 * 1000,
    });

    successResponse(res, "Admin logged in successfully", {
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    const rawRefreshToken = req.cookies?.refreshToken;
    const sessionId = req.sessionId || req.body?.sessionId;

    if (sessionId && req.user?.id) {
      await deviceSessionService
        .revokeSession({ userId: req.user.id, sessionId })
        .catch(() => {});
    } else if (rawRefreshToken) {
      // Find session by hash and revoke
      const tokenHash = deviceSessionService.hashRefreshToken(rawRefreshToken);
      await prisma.userDeviceSession.updateMany({
        where: { refreshTokenHash: tokenHash },
        data: { revokedAt: new Date(), refreshTokenHash: null },
      });
    }

    res.clearCookie("token", {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/api/v1/auth",
      ...(cookieDomain && { domain: cookieDomain }),
    });

    successResponse(res, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!rawRefreshToken) {
      return res.status(401).json({
        success: false,
        code: "INVALID_REFRESH_TOKEN",
        message: "Refresh token is missing",
      });
    }

    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip;
    const userAgent = req.headers["user-agent"] || "";

    const {
      accessToken,
      rawRefreshToken: newRefreshToken,
      session,
    } = await deviceSessionService.refreshDeviceToken({
      rawRefreshToken,
      ipAddress,
      userAgent,
    });

    const refreshedUser =
      session?.user?.email ||
      session?.user?.phoneNumber ||
      session?.userId ||
      "user";
    console.log(`[Auth] Refresh token given: ${refreshedUser}`);

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    // Update Access Token cookie
    res.cookie("token", accessToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 15 * 60 * 1000,
    });

    // Update Rotated Refresh Token cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    successResponse(res, "Token refreshed successfully", {
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    const status = error.status || 401;
    res.status(status).json({
      success: false,
      code: error.code || "INVALID_REFRESH_TOKEN",
      message: error.message || "Failed to refresh token",
    });
  }
};

export const getDevices = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return errorResponse(res, "Unauthorized", [], 401);
    }

    const currentSessionId = req.sessionId;
    const devices = await deviceSessionService.getUserDeviceSessions({
      userId,
      currentSessionId,
    });

    successResponse(res, "Devices retrieved successfully", { devices });
  } catch (error) {
    next(error);
  }
};

export const logoutDevice = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      return errorResponse(res, "Unauthorized", [], 401);
    }
    if (!sessionId) {
      return errorResponse(res, "Session ID is required", [], 400);
    }

    await deviceSessionService.revokeSession({ userId, sessionId });

    // If revoking current device, clear cookies
    if (req.sessionId === sessionId) {
      const isProduction = process.env.NODE_ENV === "production";
      const cookieDomain =
        process.env.COOKIE_DOMAIN ||
        (isProduction ? ".yuktiprep.com" : undefined);
      res.clearCookie("token", {
        httpOnly: false,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        ...(cookieDomain && { domain: cookieDomain }),
      });
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/api/v1/auth",
        ...(cookieDomain && { domain: cookieDomain }),
      });
    }

    successResponse(res, "Device logged out successfully");
  } catch (error) {
    if (error.code === "DEVICE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        code: "DEVICE_NOT_FOUND",
        message: error.message,
      });
    }
    next(error);
  }
};

export const logoutOtherDevices = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const currentSessionId = req.sessionId;

    if (!userId) {
      return errorResponse(res, "Unauthorized", [], 401);
    }

    await deviceSessionService.revokeOtherSessions({
      userId,
      currentSessionId,
    });

    successResponse(res, "All other devices logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const logoutAllDevices = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return errorResponse(res, "Unauthorized", [], 401);
    }

    await deviceSessionService.revokeAllSessions({ userId });

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain =
      process.env.COOKIE_DOMAIN ||
      (isProduction ? ".yuktiprep.com" : undefined);

    res.clearCookie("token", {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      ...(cookieDomain && { domain: cookieDomain }),
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/api/v1/auth",
      ...(cookieDomain && { domain: cookieDomain }),
    });

    successResponse(res, "All devices logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const adminLogout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain =
    process.env.COOKIE_DOMAIN || (isProduction ? ".yuktiprep.com" : undefined);

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(cookieDomain && { domain: cookieDomain }),
  });
  successResponse(res, "Admin logged out successfully");
};

export const getAdminMe = async (req, res, next) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return errorResponse(res, "Not authenticated", [], 401);
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePic: true,
        lastLoginAt: true,
      },
    });

    if (!admin) {
      return errorResponse(res, "Admin not found", [], 404);
    }

    successResponse(res, "Admin fetched successfully", { admin });
  } catch (error) {
    next(error);
  }
};

export const updateAdminMe = async (req, res, next) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return errorResponse(res, "Not authenticated", [], 401);
    }
    const admin = await authService.updateAdminProfile(adminId, req.body);
    successResponse(res, "Profile updated successfully", { admin });
  } catch (error) {
    next(error);
  }
};

export const uploadAdminPhoto = async (req, res, next) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return errorResponse(res, "Not authenticated", [], 401);
    }
    const result = await authService.uploadAdminPhoto(adminId, req.file);
    successResponse(
      res,
      "Profile photo uploaded successfully",
      result,
      {},
      201,
    );
  } catch (error) {
    next(error);
  }
};
