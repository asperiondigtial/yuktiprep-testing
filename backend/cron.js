import cron from "node-cron";
import { syncSources } from "./src/current-affairs/pipeline.js";
import { broadcastCurrentAffairsToWhatsApp } from "./services/whatsappBroadcast.service.js";
import { sendEmail } from "./services/email.service.js";
import { env } from "./config/env.js";
import prisma from "./config/prisma.js";

// Store running tasks so we can destroy them on reload
let runningTasks = [];

async function getSettingValue(key, defaultValue) {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting ? setting.value : defaultValue;
  } catch (err) {
    console.error(`Failed to get setting ${key}, using default.`);
    return defaultValue;
  }
}

export async function initializeCronJobs() {
  console.log("Initializing cron jobs...");

  // Destroy any existing running tasks before initializing
  for (const task of runningTasks) {
    task.stop();
  }
  runningTasks = [];

  const syncCron = await getSettingValue(
    "SYNC_SOURCES_CRON",
    "0 4 * * *",
  );
  const broadcastCron = await getSettingValue(
    "WHATSAPP_BROADCAST_CRON",
    "0 6 * * *",
  );
  const adminEmail = env.EMAIL_USER;

  // 1. Sync Sources Job
  if (cron.validate(syncCron)) {
    const task = cron.schedule(syncCron, async () => {
      console.log("CRON RUNNING: Sync Sources");
      try {
        const stats = await syncSources();
        console.log("CRON SUCCESS: Sync Sources completed", stats);

        await sendEmail({
          to: adminEmail,
          subject: "✅ YuktiPrep Cron: Sync Sources Completed",
          html: `<p>The scheduled sync sources cron job has completed successfully.</p>
                 <pre>${JSON.stringify(stats, null, 2)}</pre>`,
        });
      } catch (err) {
        console.error("CRON ERROR: Failed to sync sources", err);

        await sendEmail({
          to: adminEmail,
          subject: "❌ YuktiPrep Cron: Sync Sources Failed",
          html: `<p>The scheduled sync sources cron job failed.</p>
                 <p>${String(err)}</p>`,
        });
      }
    });
    runningTasks.push(task);
    console.log(`Cron registered: Sync Sources -> ${syncCron}`);
  }

  // 2. WhatsApp Broadcast Job
  if (cron.validate(broadcastCron)) {
    const task = cron.schedule(broadcastCron, async () => {
      console.log("CRON RUNNING: WhatsApp Broadcast");
      try {
        const result = await broadcastCurrentAffairsToWhatsApp();
        console.log("CRON SUCCESS: WhatsApp Broadcast completed", result);

        await sendEmail({
          to: adminEmail,
          subject: "✅ YuktiPrep Cron: WhatsApp Broadcast Completed",
          html: `<p>The daily WhatsApp Current Affairs broadcast completed.</p>
                 <pre>${JSON.stringify(result, null, 2)}</pre>`,
        });
      } catch (err) {
        console.error("CRON ERROR: WhatsApp Broadcast failed", err);

        await sendEmail({
          to: adminEmail,
          subject: "❌ YuktiPrep Cron: WhatsApp Broadcast Failed",
          html: `<p>The scheduled WhatsApp Broadcast job failed.</p>
                 <p>${String(err)}</p>`,
        });
      }
    });
    runningTasks.push(task);
    console.log(`Cron registered: WhatsApp Broadcast -> ${broadcastCron}`);
  }

  // 3. Automated Competitive Exam Sync (Every 6 hours)
  const examSyncCron = "0 */6 * * *";
  if (cron.validate(examSyncCron)) {
    const task = cron.schedule(examSyncCron, async () => {
      try {
        const { syncAllExamSources } = await import(
          "./services/competitiveExamScraper.service.js"
        );
        const stats = await syncAllExamSources();
        console.log("CRON SUCCESS: Competitive Exam Aggregator Sync finished", stats);
      } catch (err) {
        console.error("CRON ERROR: Competitive Exam Aggregator Sync failed", err);
      }
    });
    runningTasks.push(task);
    console.log(`Cron registered: Competitive Exam Aggregator -> ${examSyncCron}`);
  }

  // 4. Cleanup Expired and Revoked Device Sessions (Daily at 03:00 AM)
  const sessionCleanupCron = "0 3 * * *";
  if (cron.validate(sessionCleanupCron)) {
    const task = cron.schedule(sessionCleanupCron, async () => {
      console.log("CRON RUNNING: Cleanup Expired & Revoked Device Sessions");
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const deleteResult = await prisma.userDeviceSession.deleteMany({
          where: {
            OR: [
              { revokedAt: { lte: ninetyDaysAgo } },
              { expiresAt: { lte: ninetyDaysAgo } },
            ],
          },
        });
        console.log(
          `CRON SUCCESS: Cleaned up ${deleteResult.count} old device sessions.`,
        );
      } catch (err) {
        console.error("CRON ERROR: Failed to clean up device sessions", err);
      }
    });
    runningTasks.push(task);
    console.log(`Cron registered: Device Sessions Cleanup -> ${sessionCleanupCron}`);
  }

  // 5. Automatic Plan Expiration & Revocation (Every 15 minutes)
  const planExpirationCron = "*/15 * * * *";
  if (cron.validate(planExpirationCron)) {
    const task = cron.schedule(planExpirationCron, async () => {
      try {
        const { revokeExpiredSubscriptions } = await import("./services/subscription.service.js");
        const result = await revokeExpiredSubscriptions();
        if (result.count > 0) {
          console.log(`CRON SUCCESS: Automatically revoked ${result.count} expired subscription(s) and notified user(s).`);
        }
      } catch (err) {
        console.error("CRON ERROR: Failed to run plan expiration checks", err);
      }
    });
    runningTasks.push(task);
    console.log(`Cron registered: Automatic Plan Revocation -> ${planExpirationCron}`);
  }
}

// Function to call when admin updates settings
export async function reloadCronJobs() {
  console.log("Reloading cron jobs from updated settings...");
  await initializeCronJobs();
}
