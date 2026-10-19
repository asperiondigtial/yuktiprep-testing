import prisma from "../config/prisma.js";

async function main() {
  console.log("Adding missing columns to interview_feedback...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "interview_feedback" 
    ADD COLUMN IF NOT EXISTS "panelistEvaluations" JSONB,
    ADD COLUMN IF NOT EXISTS "subjectMastery" JSONB,
    ADD COLUMN IF NOT EXISTS "examBehaviorAnalytics" JSONB,
    ADD COLUMN IF NOT EXISTS "analytics" JSONB;
  `);
  console.log("Columns added successfully!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
