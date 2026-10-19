import rateLimit from "express-rate-limit";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Extracts the real client IP address even when behind
 * reverse proxies (Cloudflare, Nginx, AWS ALB, Render,Utho etc.)
 */
export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const clientIp =
      typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : forwarded[0];
    if (clientIp) return clientIp;
  }

  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "127.0.0.1"
  );
};

// General API rate limiter (Tracks each client IP independently)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 100000 : 3000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.method === "OPTIONS" || isDev,
});

// Auth endpoints rate limiter (Tracks each client IP independently)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.method === "OPTIONS" || req.method !== "POST",
});

// Payment rate limiter (Tracks each client IP independently)
export const paymentLimiter = rateLimit({
  windowMs: 300 * 1000, // 1 minute
  max: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  skip: (req) => req.method === "OPTIONS",
});

// OTP rate limiter (Tracks Client IP + Target Phone Number)
// Prevents one user on a shared Wi-Fi/NAT network from blocking other users
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDev ? 500 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const phone = req.body?.phone ? String(req.body.phone).trim() : "";
    return `${ip}_${phone}`;
  },
  skip: (req) => req.method === "OPTIONS" || req.method !== "POST",
  message: {
    success: false,
    message: "Too many OTP requests for this number/IP. Please try again after 1 minute.",
  },
});
