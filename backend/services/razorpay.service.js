import Razorpay from "razorpay";
import { env } from "../config/env.js";
import crypto from "crypto";

export const getRazorpay = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
};

export const createRazorpayPlan = async (payload) => {
  const razorpay = getRazorpay();
  return razorpay.plans.create(payload);
};

export const createRazorpaySubscription = async (payload) => {
  const razorpay = getRazorpay();
  return razorpay.subscriptions.create(payload);
};

export const fetchRazorpaySubscription = async (subscriptionId) => {
  const razorpay = getRazorpay();
  return razorpay.subscriptions.fetch(subscriptionId);
};

export const cancelRazorpaySubscription = async (subscriptionId, payload = {}) => {
  const razorpay = getRazorpay();
  return razorpay.subscriptions.cancel(subscriptionId, payload);
};

export const verifyPaymentSignature = (payload, body, secret) => {
  const signature = payload["X-Razorpay-Signature"];
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
  return signature === expected;
};

export const verifyWebhookSignature = (payload, secret) => {
  const signature = payload["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", secret).update(payload.rawBody || "").digest("hex");
  return signature === expected;
};

export const createRazorpayRefund = async (paymentId, amountInPaise, notes = {}) => {
  const razorpay = getRazorpay();
  const options = {
    notes,
    reverse_all: 1,
  };
  if (amountInPaise) {
    options.amount = amountInPaise;
  }
  return razorpay.payments.refund(paymentId, options);
};

export const fetchRazorpayPayment = async (paymentId) => {
  const razorpay = getRazorpay();
  return razorpay.payments.fetch(paymentId);
};
