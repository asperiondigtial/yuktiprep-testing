import prisma from "../config/prisma.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ensureUserFreeSubscription } from "./subscription.service.js";
import crypto from "crypto";
import path from "path";
import sharp from "sharp";


const endpoint = process.env.UTHO_ENDPOINT || "https://innoida.utho.io";
const region = process.env.UTHO_ZONE || "ap-south-in-noida-1";
const accessKeyId =
  process.env.UTHO_KEY || process.env.AWS_ACCESS_KEY_ID || "";
const secretAccessKey =
  process.env.UTHO_SECRET || process.env.AWS_SECRET_ACCESS_KEY || "";
const bucketName =
  process.env.UTHO_BUCKET || process.env.AWS_BUCKET_NAME || "yukit-prep";

const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true,
});

export const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
      role: true,
      language: true,
      state: true,
      difficulty: true,
      timezone: true,
      deliveryHour: true,
      channels: true,
      active: true,
      examGroupId: true,
      examOptionId: true,
      examGroup: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
      examOption: {
        select: { id: true, title: true, logoUrl: true },
      },
      createdAt: true,
      updatedAt: true,
      profilePic: true,
      learnerProfile: {
        include: {
          targetExam: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      subscriptions: {
        where: {
          status: { not: "cancelled" },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Prioritize paid active subscription over free subscription
  if (user.subscriptions && user.subscriptions.length > 0) {
    user.subscriptions.sort((a, b) => {
      const aPaid = (a.plan?.price || 0) > 0 && a.status === "active";
      const bPaid = (b.plan?.price || 0) > 0 && b.status === "active";
      if (aPaid && !bPaid) return -1;
      if (!aPaid && bPaid) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // Keep only the primary subscription in the subscriptions array
    user.subscriptions = [user.subscriptions[0]];
  } else {
    const freeSub = await ensureUserFreeSubscription(userId);
    if (freeSub) {
      user.subscriptions = [freeSub];
    }
  }

  return user;
};


export const updateMyProfile = async (userId, data) => {
  const updateData = {
    name: data.name,
    language: data.language,
    state: data.state,
    difficulty: data.difficulty,
    timezone: data.timezone,
    deliveryHour: data.deliveryHour,
  };

  if (data.learnerProfile) {
    updateData.learnerProfile = {
      upsert: {
        create: {
          attemptYear: data.learnerProfile.attemptYear ? parseInt(data.learnerProfile.attemptYear) : null,
          studyHoursPerDay: data.learnerProfile.studyHoursPerDay ? parseFloat(data.learnerProfile.studyHoursPerDay) : null,
        },
        update: {
          attemptYear: data.learnerProfile.attemptYear ? parseInt(data.learnerProfile.attemptYear) : null,
          studyHoursPerDay: data.learnerProfile.studyHoursPerDay ? parseFloat(data.learnerProfile.studyHoursPerDay) : null,
        }
      }
    };
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
      role: true,
      language: true,
      state: true,
      difficulty: true,
      timezone: true,
      deliveryHour: true,
      channels: true,
      active: true,
      examGroupId: true,
      examOptionId: true,
      examGroup: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
      examOption: {
        select: { id: true, title: true, logoUrl: true },
      },
      createdAt: true,
      updatedAt: true,
      profilePic: true,
      learnerProfile: {
        include: {
          targetExam: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
      subscriptions: {
        where: {
          status: { not: "cancelled" },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  return updatedUser;
};

export const uploadProfilePhoto = async (userId, file) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  const targetBucket = bucketName;
  if (!targetBucket) {
    throw new Error("Utho bucket is not configured");
  }

  // Convert image to WebP with optimized dimensions and high compression
  const optimizedBuffer = await sharp(file.buffer)
    .rotate() // Automatically orient based on EXIF
    .resize(512, 512, {
      fit: "cover",
      position: "center",
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const uniqueId = crypto.randomBytes(16).toString("hex");
  const filename = `profiles/${userId}/${uniqueId}.webp`;

  const uploadParams = {
    Bucket: targetBucket,
    Key: filename,
    Body: optimizedBuffer,
    ContentType: "image/webp",
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  // Construct Utho Path-Style URL
  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const fileUrl = `${cleanEndpoint}/${targetBucket}/${filename}`;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { profilePic: fileUrl },
    select: {
      id: true,
      email: true,
      name: true,
      phoneNumber: true,
      role: true,
      language: true,
      state: true,
      difficulty: true,
      timezone: true,
      deliveryHour: true,
      channels: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      profilePic: true,
      learnerProfile: true,
      subscriptions: {
        where: {
          status: { not: "cancelled" },
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  return { url: fileUrl, user: updatedUser };
};
