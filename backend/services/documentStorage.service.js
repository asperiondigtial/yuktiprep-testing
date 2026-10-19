import crypto from "crypto";
import path from "path";
import fs from "fs";
import dns from "dns/promises";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.UTHO_ENDPOINT;
const region = process.env.UTHO_ZONE || process.env.AWS_REGION || "ap-south-in-noida-1";
const accessKeyId = process.env.UTHO_KEY || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.UTHO_SECRET || process.env.AWS_SECRET_ACCESS_KEY;
const bucketName = process.env.UTHO_BUCKET || process.env.AWS_BUCKET_NAME || "yukit-prep";

const s3Configured = Boolean(
  region &&
  accessKeyId &&
  secretAccessKey &&
  bucketName
);

const s3Client = s3Configured
  ? new S3Client({
      ...(endpoint ? { endpoint } : {}),
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: Boolean(endpoint),
    })
  : null;

/**
 * Computes SHA-256 hash from a Buffer.
 * @param {Buffer} buffer
 * @returns {string} hex digest
 */
export const computeChecksum = (buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

/**
 * Stores file payload either in S3 or encrypted local fallback directory.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimeType
 * @returns {Promise<{ fileKey: string, fileUrl: string }>}
 */
export const storeEncryptedDocument = async (buffer, originalName, mimeType = "application/pdf") => {
  const ext = path.extname(originalName) || ".pdf";
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const fileKey = `intelligence-sources/${uniqueId}${ext}`;

  if (s3Configured && s3Client) {
    const targetBucket = bucketName;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: targetBucket,
        Key: fileKey,
        Body: buffer,
        ContentType: mimeType,
        ContentDisposition: `attachment; filename="${originalName}"`,
      })
    );
    const fileUrl = endpoint
      ? `${endpoint}/${targetBucket}/${fileKey}`
      : `https://${targetBucket}.s3.${region}.amazonaws.com/${fileKey}`;
    return { fileKey, fileUrl };
  }

  // Local filesystem fallback storage
  const localDir = path.resolve(process.cwd(), "uploads", "intelligence");
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const localFilePath = path.join(localDir, `${uniqueId}${ext}`);
  fs.writeFileSync(localFilePath, buffer);

  const fileUrl = `/uploads/intelligence/${uniqueId}${ext}`;
  return { fileKey: localFilePath, fileUrl };
};

const isPrivateIPv4 = (ip) => {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // current network
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved
  return false;
};

const isPrivateIPv6 = (ip) => {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA fc00::/7
  return false;
};

const isIpAddress = (host) => {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return "ipv4";
  if (host.includes(":")) return "ipv6";
  return null;
};

const assertSafeRemoteUrl = async (parsedUrl) => {
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("URL with embedded credentials is not allowed.");
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Localhost targets are not allowed.");
  }

  const hostType = isIpAddress(host);
  if (hostType === "ipv4" && isPrivateIPv4(host)) {
    throw new Error("Private or local network IPv4 targets are not allowed.");
  }
  if (hostType === "ipv6" && isPrivateIPv6(host)) {
    throw new Error("Private or local network IPv6 targets are not allowed.");
  }

  const records = await dns.lookup(host, { all: true });
  for (const record of records) {
    const addr = record.address;
    if (record.family === 4 && isPrivateIPv4(addr)) {
      throw new Error("Resolved IPv4 address points to a private or local network.");
    }
    if (record.family === 6 && isPrivateIPv6(addr)) {
      throw new Error("Resolved IPv6 address points to a private or local network.");
    }
  }
};

/**
 * Fetch remote PDF from a given URL with mime validation and streaming SHA-256 computation.
 * @param {string} url
 * @returns {Promise<{ buffer: Buffer, checksum: string, mimeType: string, filename: string }>}
 */
export const fetchRemotePdf = async (url) => {
  // Validate protocol
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid URL protocol. Only HTTP and HTTPS are permitted.");
  }
  await assertSafeRemoteUrl(parsed);

  const response = await fetch(parsed.toString(), {
    headers: {
      "User-Agent": "YuktiPrep-QuestionIntelligence/1.0",
      Accept: "application/pdf,application/octet-stream,*/*",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch remote document from URL: HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "application/pdf";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("The remote document fetched from URL is empty.");
  }

  const checksum = computeChecksum(buffer);
  
  // Try extracting filename from path
  const urlPath = parsed.pathname;
  let filename = path.basename(urlPath);
  if (!filename || !filename.includes(".")) {
    filename = `remote-source-${checksum.slice(0, 8)}.pdf`;
  }

  return {
    buffer,
    checksum,
    mimeType: contentType.split(";")[0],
    filename,
  };
};

/**
 * Retrieve document Buffer from S3 or local storage for parsing.
 * @param {string} fileKey
 * @returns {Promise<Buffer>}
 */
export const getDocumentBuffer = async (fileKey) => {
  if (!fileKey) {
    throw new Error("File key is required to load document buffer.");
  }

  // Check local filesystem first
  if (fs.existsSync(fileKey)) {
    return fs.readFileSync(fileKey);
  }

  // If stored in S3
  if (s3Configured && s3Client && bucketName) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      })
    );
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  throw new Error(`Document file not found at ${fileKey}`);
};

