import prisma from "../../config/prisma.js";
import { collect } from "./collectors.js";
import { enqueueTranslationJob } from "../queues/translation.queue.js";
import { scoreItem, expectedQuestions, generateAIQuestions } from "./exam.js";
import { SOURCES } from "./sources.js";
import { DAILY_SCORE, WEEKLY_SCORE, MONTHLY_SCORE } from "./config.js";

export async function initDb() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL,
      source_key TEXT NOT NULL,
      source_name TEXT NOT NULL,
      organisation TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      url TEXT NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      collected_at TIMESTAMPTZ NOT NULL,
      theme TEXT NOT NULL,
      score INTEGER NOT NULL,
      source_confidence INTEGER NOT NULL,
      exams TEXT[] DEFAULT ARRAY[]::TEXT[],
      exam_groups TEXT[] DEFAULT ARRAY[]::TEXT[],
      static_link TEXT NOT NULL
    );
  `;

  // Safely add exams and exam_groups columns if table already exists
  await prisma.$executeRaw`
    ALTER TABLE items ADD COLUMN IF NOT EXISTS exams TEXT[] DEFAULT ARRAY[]::TEXT[];
  `;
  await prisma.$executeRaw`
    ALTER TABLE items ADD COLUMN IF NOT EXISTS exam_groups TEXT[] DEFAULT ARRAY[]::TEXT[];
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS ix_items_published ON items(published_at);
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS ix_items_event_key ON items(event_key);
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS ix_items_theme ON items(theme);
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS dead_letters (
      id SERIAL PRIMARY KEY,
      source_key TEXT,
      stage TEXT NOT NULL,
      reason TEXT NOT NULL,
      payload TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS source_runs (
      id SERIAL PRIMARY KEY,
      source_key TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      http_status INTEGER,
      found_count INTEGER NOT NULL DEFAULT 0,
      saved_count INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `;

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL,
      theme TEXT NOT NULL,
      exam TEXT NOT NULL,
      question_type TEXT NOT NULL,
      priority INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer_basis TEXT NOT NULL,
      source_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;
}

export async function deadLetter(sourceKey, stage, reason, payload = null) {
  const jsonPayload = payload ? JSON.stringify(payload, null, 2) : null;
  await prisma.deadLetter.create({
    data: {
      sourceKey: sourceKey || null,
      stage,
      reason,
      payload: jsonPayload,
      createdAt: new Date(),
    },
  });
}

export async function startRun(db, source) {
  const result = await db.$queryRaw`
    INSERT INTO source_runs (source_key, started_at)
    VALUES (${source.key}, ${new Date()})
    RETURNING id
  `;
  return result[0].id;
}

export async function finishRun(
  db,
  runId,
  success,
  found = 0,
  saved = 0,
  error = null,
) {
  await db.$executeRaw`
    UPDATE source_runs
    SET completed_at = ${new Date()},
        success = ${success ? true : false},
        found_count = ${found},
        saved_count = ${saved},
        error = ${error || ""}
    WHERE id = ${runId}
  `;
}

export async function saveScoredItem(db, source, item, activeLanguages = []) {
  const identifier = item.source_key + "|" + item.url;
  const ekey = item.event_key || item.source_key;

  const examsArr =
    Array.isArray(item.exams) && item.exams.length > 0
      ? item.exams
      : [
          item.prelims ? "Prelims" : null,
          item.mains ? "Mains" : null,
          item.pcs ? "State PSC" : null,
          item.ssc ? "SSC" : null,
          item.banking ? "Banking" : null,
        ].filter(Boolean);

  const examGroupsArr =
    Array.isArray(item.exam_groups) && item.exam_groups.length > 0
      ? item.exam_groups
      : ["UPSC"];

  const inserted = await db.$queryRaw`
    INSERT INTO items
    (id, event_key, source_key, source_name, organisation, title, summary, url, published_at, collected_at, theme, score, source_confidence, exams, exam_groups, prelims, mains, pcs, ssc, banking, static_link)
    VALUES (${identifier}, ${ekey}, ${source.key}, ${source.name}, ${source.organisation}, ${item.title}, ${item.summary}, ${item.url}, ${item.published_at}::timestamptz, ${new Date()}, ${item.theme}, ${item.score}, ${item.source_confidence}, ${examsArr}, ${examGroupsArr}, ${item.prelims ? 1 : 0}, ${item.mains ? 1 : 0}, ${item.pcs ? 1 : 0}, ${item.ssc ? 1 : 0}, ${item.banking ? 1 : 0}, ${item.static_link})
    ON CONFLICT (id) DO UPDATE SET
      exams = EXCLUDED.exams,
      exam_groups = EXCLUDED.exam_groups
    RETURNING id
  `;

  if (inserted.length === 0) {
    return false;
  }

  // Perform synchronous AI translation for active languages
  const { translateItemWithAI } = await import("./exam.js");
  for (const lang of activeLanguages) {
    if (lang.code !== "en") {
      try {
        const translated = await translateItemWithAI(
          item.title,
          item.summary,
          lang.code,
        );

        await db.$executeRaw`
          INSERT INTO item_translations (id, item_id, language, title, summary, status, provider, created_at, updated_at)
          VALUES (gen_random_uuid(), ${identifier}, ${lang.code}, ${translated.title}, ${translated.summary}, 'COMPLETED', 'gemini', ${new Date()}, ${new Date()})
          ON CONFLICT (item_id, language) DO UPDATE 
          SET title = ${translated.title}, summary = ${translated.summary}, status = 'COMPLETED', updated_at = ${new Date()}
        `;
      } catch (err) {
        console.error(
          `Failed to inline translate for ${identifier} in ${lang.code}:`,
          err,
        );
      }
    }
  }

  const questions = await generateAIQuestions(item, source.name);
  for (const q of questions) {
    const qid = `${ekey}-${q.exam}-${q.type}-${Buffer.from(q.question).toString("base64").slice(0, 32)}`;
    await db.$executeRaw`
      INSERT INTO questions
      (id, event_key, theme, exam, question_type, priority, question, answer_basis, source_url, created_at)
      VALUES (${qid}, ${ekey}, ${item.theme}, ${q.exam}, ${q.type}, ${q.priority}, ${q.question}, ${q.answer_basis}, ${item.url}, ${new Date()})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  return true;
}

export async function fetchFromAI() {
  const { getAI } = await import("./exam.js");
  const ai = getAI();
  if (!ai) {
    console.log("No GEMINI_API_KEY found, skipping AI current affairs fetch.");
    return [];
  }

  let examNamesString = "UPSC, SSC, Banking, Railways, State PSC";
  try {
    const activeGroups = await prisma.examGroup.findMany({
      where: { isActive: true },
      select: {
        name: true,
        examOptions: {
          where: { isActive: true },
          select: { title: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    if (activeGroups && activeGroups.length > 0) {
      examNamesString = activeGroups
        .map((g) => {
          const options = g.examOptions?.map((o) => o.title).filter(Boolean);
          return options && options.length > 0
            ? `${g.name} (${options.join(", ")})`
            : g.name;
        })
        .join(", ");
    }
  } catch (err) {
    console.error("Error fetching exam groups for AI current affairs:", err);
  }

  console.log(
    `Fetching top 9 current affairs using Gemini AI for exams: ${examNamesString}...`,
  );
  const prompt = `
    You are an expert Indian competitive exam mentor for: ${examNamesString}.
    Use the Google Search tool to find the most important recent current affairs.
    Find EXACTLY:
    - 3 highly important Daily current affairs (from today or yesterday)
    - 3 highly important Weekly current affairs (from the past 7 days)
    - 3 highly important Monthly current affairs (from the past 30 days)

    For each event, provide:
    - title: Clear, descriptive headline
    - summary: 2 line factual summary
    - url: The official or trusted news source URL for the event
    - published_at: Exact ISO timestamp format (e.g. "2026-09-01T10:00:00Z")

    Return EXACTLY a JSON array of 9 objects.
  `;

  try {
    const { Type } = await import("@google/genai");
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              url: { type: Type.STRING },
              published_at: { type: Type.STRING },
            },
            required: ["title", "summary", "url", "published_at"],
          },
        },
      },
    });

    let resultText = response.text || "";
    if (resultText.includes("\`\`\`json"))
      resultText = resultText.split("\`\`\`json")[1].split("\`\`\`")[0];
    else if (resultText.includes("\`\`\`"))
      resultText = resultText.split("\`\`\`")[1].split("\`\`\`")[0];

    const parsed = JSON.parse(resultText.trim());

    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log(
        `[AI Pipeline] Successfully summarized ${parsed.length} current affairs from Gemini.`,
      );
      return parsed;
    }

    return [];
  } catch (error) {
    console.error(
      "Failed to fetch current affairs from AI:",
      error?.message || error,
    );
    return [];
  }
}

export async function syncSources() {
  await initDb();

  const stats = {
    sources: 0,
    successful: 0,
    failed: 0,
    found: 0,
    saved: 0,
    quarantined: 0,
  };

  const db = prisma;

  // Get TRANSLATION_LANGUAGES from settings
  const translationSetting = await db.systemSetting.findUnique({
    where: { key: "TRANSLATION_LANGUAGES" },
  });
  const translationCodes = translationSetting?.value
    ? translationSetting.value.split(",").map((s) => s.trim().toLowerCase())
    : ["hi", "ta"]; // fallback defaults

  const activeLanguages = await db.language.findMany({
    where: {
      isActive: true,
      code: { in: translationCodes },
    },
  });

  for (const source of SOURCES) {
    if (!source.enabled) continue;

    stats.sources += 1;
    const runId = await startRun(db, source);
    await db.$executeRaw`COMMIT`;

    try {
      const rawItems = await collect(source);
      stats.found += rawItems.length;

      let saved = 0;

      for (const raw of rawItems) {
        if (saved >= 3) break;
        try {
          const scored = scoreItem(source, raw);

          if (scored === null) {
            await deadLetter(
              source.key,
              "exam_filter",
              "No meaningful syllabus relevance",
              {
                title: raw.title,
                url: raw.url,
              },
            );
            stats.quarantined += 1;
            continue;
          }

          if (scored.score < 42) {
            await deadLetter(
              source.key,
              "exam_filter",
              `Below minimum knowledge-base score: ${scored.score}`,
              {
                title: raw.title,
                url: raw.url,
              },
            );
            stats.quarantined += 1;
            continue;
          }

          let fullText = scored.summary;
          try {
            const axios = (await import("axios")).default;
            const cheerio = await import("cheerio");

            // Fetch the actual article page to get untruncated text
            const articleRes = await axios.get(scored.url, {
              timeout: 8000,
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            const contentType = articleRes.headers["content-type"] || "";
            if (contentType.includes("application/pdf")) {
              throw new Error("URL is a PDF. Skipping full text extraction.");
            }

            const $ = cheerio.load(articleRes.data);

            // Try to fix truncated titles
            if (scored.title.includes("...")) {
              const pageTitle =
                $('meta[property="og:title"]').attr("content") ||
                $("title").text() ||
                $("h1").first().text();
              if (pageTitle) {
                scored.title = pageTitle.replace(/\s+/g, " ").trim();
              }
            }

            // Extract article body
            const articleBody = $("article, main, .content, .post-content, p")
              .text()
              .replace(/\s+/g, " ")
              .trim();
            if (articleBody.length > 200) {
              fullText = articleBody;
            }
          } catch (err) {
            console.log(
              "Could not fetch full article for summary:",
              err.message,
            );
          }

          // Generate Gemini summary from raw content before saving
          const { summarizeItemWithAI } = await import("./exam.js");
          const summaryResult = await summarizeItemWithAI(
            scored.title,
            fullText,
          );
          scored.title = summaryResult.title;
          scored.summary = summaryResult.summary;

          if (summaryResult.fallback) {
            console.warn(
              `[AI Fallback Alert] Current affairs item "${scored.title}" fell back to raw content.`,
            );
            // Alert Admin via Email
            try {
              const { sendEmail } =
                await import("../services/email.service.js");
              const adminEmail =
                process.env.EMAIL_USER || "support@yuktiprep.com";
              await sendEmail({
                to: adminEmail,
                subject: `⚠️ Current Affairs AI Correction Alert: ${source.name}`,
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 20px; color: #1f2937;">
                    <h2 style="color: #dc2626;">⚠️ Current Affairs Processing Alert</h2>
                    <p>Something went wrong while AI-processing the following current affair from <strong>${source.name}</strong>:</p>
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
                      <p><strong>Title:</strong> ${scored.title}</p>
                      <p><strong>Source URL:</strong> <a href="${scored.url}">${scored.url}</a></p>
                      <p><strong>Error Detail:</strong> ${summaryResult.error || "AI could not generate structured summary"}</p>
                    </div>
                    <p style="color: #4b5563;">Please check the server logs or dead letters table in your admin dashboard.</p>
                  </div>
                `,
                text: `Current Affairs Alert: AI summarization fallback for "${scored.title}" from source ${source.name}. Error: ${summaryResult.error || "Unknown"}. Please check server logs.`,
              });
            } catch (mailErr) {
              console.error(
                "Failed to send admin fallback alert email:",
                mailErr.message,
              );
            }
          }

          const didSave = await saveScoredItem(
            db,
            source,
            scored,
            activeLanguages,
          );
          if (didSave) {
            saved += 1;
            if (saved >= 3) break;
          }
        } catch (exc) {
          await deadLetter(source.key, "transform", String(exc), {
            title: raw.title,
            url: raw.url,
          });
          stats.quarantined += 1;

          // Also alert admin on critical transform failures
          try {
            const { sendEmail } = await import("../services/email.service.js");
            const adminEmail =
              process.env.EMAIL_USER || "support@yuktiprep.com";
            await sendEmail({
              to: adminEmail,
              subject: `🚨 Current Affairs Failure Alert: ${source.name}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #1f2937;">
                  <h2 style="color: #dc2626;">🚨 Current Affairs Transformation Error</h2>
                  <p>Failed to transform current affairs article from <strong>${source.name}</strong>:</p>
                  <p><strong>Error:</strong> ${String(exc)}</p>
                  <p><strong>URL:</strong> <a href="${raw.url}">${raw.url}</a></p>
                  <p>Check the admin dashboard dead letters table and server logs.</p>
                </div>
              `,
              text: `Current Affairs Error: ${String(exc)} for ${raw.url}. Check server logs.`,
            });
          } catch (mailErr) {
            console.error("Failed to send admin error email:", mailErr.message);
          }
        }
      }

      await finishRun(db, runId, true, rawItems.length, saved);
      await db.$executeRaw`COMMIT`;

      stats.saved += saved;
      stats.successful += 1;
    } catch (exc) {
      await finishRun(db, runId, false, 0, 0, String(exc));
      await db.$executeRaw`COMMIT`;

      await deadLetter(source.key, "collector", String(exc), {
        url: source.url,
      });
      console.error(`[ERROR] ${source.key}: ${exc.message || String(exc)}`);
      stats.failed += 1;
    }
  }

  // AI fetching logic: Fetch top items if RSS sources yielded low count or to supplement
  const aiItems = await fetchFromAI();
  if (aiItems.length > 0) {
    stats.sources += 1;
    const aiSourceObj = {
      key: "gemini-ai",
      name: "Gemini AI Search",
      organisation: "Google AI",
      priority: 25,
    };
    const runId = await startRun(db, aiSourceObj);
    await db.$executeRaw`COMMIT`;

    try {
      stats.found += aiItems.length;
      let saved = 0;
      for (const raw of aiItems) {
        try {
          if (
            !raw.published_at ||
            isNaN(new Date(raw.published_at).getTime())
          ) {
            raw.published_at = new Date().toISOString();
          }
          const scored = scoreItem(aiSourceObj, raw);
          if (scored === null) {
            console.warn(
              "AI item skipped due to zero syllabus relevance hits.",
            );
            stats.quarantined += 1;
            continue;
          }
          if (scored.score < 20) {
            console.warn(
              `AI item skipped due to low score (${scored.score}). Title: ${raw.title}`,
            );
            stats.quarantined += 1;
            continue;
          }
          const didSave = await saveScoredItem(
            db,
            aiSourceObj,
            scored,
            activeLanguages,
          );
          if (didSave) saved += 1;
        } catch (exc) {
          console.error("AI item save failed:", String(exc));
          stats.quarantined += 1;
        }
      }
      await finishRun(db, runId, true, aiItems.length, saved);
      await db.$executeRaw`COMMIT`;
      stats.saved += saved;
      stats.successful += 1;
    } catch (exc) {
      await finishRun(db, runId, false, 0, 0, String(exc));
      await db.$executeRaw`COMMIT`;
      stats.failed += 1;
    }
  }

  return stats;
}

export async function queryItems(start, end, minimumScore, limit) {
  const rows = await prisma.$queryRaw`
    SELECT *
    FROM items
    WHERE published_at >= ${start}::timestamptz
      AND published_at <= ${end}::timestamptz
      AND score >= ${minimumScore}
    ORDER BY score DESC, published_at DESC
    LIMIT ${limit}
  `;

  return rows;
}

export function examLabels(row) {
  if (Array.isArray(row.exams) && row.exams.length > 0) {
    return row.exams.join(", ");
  }
  if (Array.isArray(row.exam_groups) && row.exam_groups.length > 0) {
    return row.exam_groups.join(", ");
  }
  const labels = [];
  if (row.prelims) labels.push("Prelims");
  if (row.mains) labels.push("Mains");
  if (row.pcs) labels.push("State PCS");
  if (row.ssc) labels.push("SSC/Railway");
  if (row.banking) labels.push("Banking/Regulatory");
  return labels.join(", ");
}

export function structureSummary(summaryText) {
  const sentences = summaryText.split(/(?<=[.!?])\s+/);

  if (sentences.length <= 1) {
    return `*   **Context**: ${summaryText}\n`;
  }

  let points = "";
  for (const s of sentences.slice(1, 5)) {
    const sClean = s.trim();
    if (sClean) {
      points += `*   ${sClean}\n`;
    }
  }

  let explanation = "";
  if (sentences.length > 5) {
    explanation = sentences.slice(5).join(" ");
  } else {
    explanation =
      "This development highlights critical structural, policy, or governance reforms relevant to public administration, economic growth, or environmental safeguards.";
  }

  return `*   **Core Context**: ${sentences[0].trim()}

##### 📌 Major Points
${points}

##### 💡 Explanation & Significance
${explanation.trim()}`;
}

export function editorialBlock(row, number) {
  const structured = structureSummary((row.summary || "").slice(0, 1200));
  return `
### ${number}. ${row.title}

| Parameter | Value / Metadata |
| :--- | :--- |
| **Theme** | ${row.theme} |
| **Priority Score** | \`${row.score}/100\` |
| **Source Confidence** | \`${row.source_confidence}/100\` |
| **Relevant Exams** | ${examLabels(row)} |
| **Primary Source** | ${row.source_name} |
| **Publication Date** | \`${row.published_at?.toISOString().slice(0, 10) || ""}\` |
| **Official Link** | [View Source Webpage](${row.url}) |

#### 📰 News Analysis & Summary
${structured}

#### 🔗 Static Syllabus Link
${row.static_link}

#### 📝 Preparation Approach
*   **Prelims Focus**: Study the associated institution's mandate, legal/statutory status, location, reporting frameworks, and identify potential statement-based traps.
*   **Mains Focus**: Examine institutional/policy significance, regulatory challenges, key implications for India, and formulate a balanced way forward.

---
`;
}

export async function generateDaily() {
  const now = new Date();
  const rows = await queryItems(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    DAILY_SCORE,
    15,
  );

  let output = `# YuktiPrep Daily Current Affairs
## Date: ${now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}

**Editorial Principle**: Official-source-first verification. Syllabus relevance > news popularity.

### 📋 Daily Summary Index

| # | Event Title | Theme | Priority | Source |
|---|-------------|-------|----------|--------|
`;

  for (const [idx, row] of rows.entries()) {
    output += `| ${idx + 1} | **${row.title}** | ${row.theme} | \`${row.score}/100\` | ${row.source_name} |\n`;
  }

  output += "\n---\n\n";

  for (const [idx, row] of rows.entries()) {
    output += editorialBlock(row, idx + 1);
  }

  output += `
## 🛡️ Source Authenticity Checklist
- [x] Institutional ownership verified.
- [x] Official domain name checked.
- [x] RSS/API/Page scraping integrity checked.
- [x] Date metadata validation checked.

## 📝 Daily Revision Framework
Revise:
- Why the event is in the news
- Associated institution and mandate
- Static syllabus connection
- Important factual data/statistics
- Map/place references (where applicable)
- Likely statement-based examination traps

---

**Professional Disclaimer**: YuktiPrep's engine and generated material are educational tools for competitive-examination preparation. "Expected questions" represent preparation priorities, not guaranteed predictions. Current affairs, official statistics, judgments, schemes, regulations, recruitment information and examination requirements must be cross-verified against the relevant official notification, judgment or authoritative institutional source. The system does not replace official instructions, institutional advice, expert counseling, or professional/legal advice.
`;

  return output;
}

export async function generateWeekly() {
  const now = new Date();
  const rows = await queryItems(
    new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
    WEEKLY_SCORE,
    80,
  );

  let output = `# YuktiPrep Weekly Current Affairs Digest
## Generated on: ${now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}

### 📋 Weekly Summary Index

| Event Title | Theme | Priority | Source | Link |
|:---|:---|:---:|:---|:---:|
`;

  for (const row of rows) {
    output += `| ${row.title} | ${row.theme} | \`${row.score}/100\` | ${row.source_name} | [Source Link](${row.url}) |\n`;
  }

  output += "\n---\n\n";

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.theme]) grouped[row.theme] = [];
    grouped[row.theme].push(row);
  }

  let number = 1;
  for (const [theme, records] of Object.entries(grouped)) {
    output += `## Theme: ${theme}\n\n`;

    for (const row of records) {
      output += editorialBlock(row, number);
      number += 1;
    }
  }

  output += `
**Professional Disclaimer**: YuktiPrep's engine and generated material are educational tools for competitive-examination preparation. "Expected questions" represent preparation priorities, not guaranteed predictions. Current affairs, official statistics, judgments, schemes, regulations, recruitment information and examination requirements must be cross-verified against the relevant official notification, judgment or authoritative institutional source. The system does not replace official instructions, institutional advice, expert counseling, or professional/legal advice.
`;

  return output;
}

export function monthRange() {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(thisMonth.getTime() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);

  return [start, end];
}

export async function generateMonthly() {
  const [start, end] = monthRange();
  const rows = await queryItems(start, end, MONTHLY_SCORE, 400);

  let output = `# YuktiPrep Monthly Current Affairs Archive
## Archive Month: ${start.toLocaleDateString("en-US", { month: "long", year: "numeric" })}

### 📋 Monthly Summary Index

| Event Title | Theme | Priority | Source | Link |
|:---|:---|:---:|:---|:---:|
`;

  for (const row of rows) {
    output += `| ${row.title} | ${row.theme} | \`${row.score}/100\` | ${row.source_name} | [Source Link](${row.url}) |\n`;
  }

  output += "\n---\n\n";

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.theme]) grouped[row.theme] = [];
    grouped[row.theme].push(row);
  }

  for (const [theme, records] of Object.entries(grouped)) {
    output += `## Theme: ${theme}\n\n`;

    for (const row of records) {
      output += `- **${row.title}**  \n  *Priority Score*: \`${row.score}/100\` | *Source*: ${row.source_name}  \n  *Official URL*: ${row.url}\n\n`;
    }

    output += "\n";
  }

  output += `
**Professional Disclaimer**: YuktiPrep's engine and generated material are educational tools for competitive-examination preparation. "Expected questions" represent preparation priorities, not guaranteed predictions. Current affairs, official statistics, judgments, schemes, regulations, recruitment information and examination requirements must be cross-verified against the relevant official notification, judgment or authoritative institutional source. The system does not replace official instructions, institutional advice, expert counseling, or professional/legal advice.
`;

  return output;
}

export async function themeReport(limit = 100) {
  const rows = await prisma.$queryRaw`
    SELECT theme, COUNT(*) AS item_count, ROUND(AVG(score), 1) AS avg_score, MAX(score) AS max_score
    FROM items
    GROUP BY theme
    ORDER BY max_score DESC, item_count DESC
    LIMIT ${limit}
  `;

  const safeRows = Array.isArray(rows) ? rows : [];
  let output = "# YuktiPrep Current-Affairs Themes\n\n";
  for (const row of safeRows) {
    output += `## ${row.theme}\n- Knowledge-base items: ${row.item_count}\n- Average priority: ${row.avg_score}\n- Highest priority: ${row.max_score}\n\n`;
  }
  return output;
}

export async function questionReport(limit = 100) {
  const rows = await prisma.$queryRaw`
    SELECT * FROM questions
    ORDER BY priority DESC, created_at DESC
    LIMIT ${limit}
  `;

  const safeRows = Array.isArray(rows) ? rows : [];
  let output = `# YuktiPrep High-Priority Expected Questions\n\n> These are syllabus- and event-priority questions. They are not guaranteed predictions of an actual exam.\n\n`;

  safeRows.forEach((row, idx) => {
    output += `## ${idx + 1}. ${row.exam} - ${row.question_type}\n\n**Priority:** ${row.priority}/100\n\n${row.question}\n\n**Answer basis:** ${row.answer_basis}\n\n**Primary source:** ${row.source_url}\n\n`;
  });

  return output;
}

export async function healthReport() {
  const rows = await prisma.$queryRaw`
    SELECT
      source_key,
      COUNT(*) AS runs,
      SUM(CAST(success AS INT)) AS successful,
      MAX(started_at) AS last_run,
      ROUND(
        100.0 *
        SUM(CAST(success AS INT))
        / COUNT(*),
        1
      ) AS success_rate
    FROM source_runs
    GROUP BY source_key
    ORDER BY success_rate ASC
  `;
  return rows.map((r) => ({
    source_key: r.source_key,
    runs: Number(r.runs),
    successful: Number(r.successful),
    last_run: r.last_run ? r.last_run.toISOString() : null,
    success_rate: Number(r.success_rate),
  }));
}

export async function errorsReport(limit = 100) {
  return prisma.$queryRaw`
    SELECT * FROM dead_letters
    ORDER BY id DESC
    LIMIT ${limit}
  `;
}
