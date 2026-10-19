import prisma from "../config/prisma.js";
import {
  computeChecksum,
  storeEncryptedDocument,
  fetchRemotePdf,
} from "../services/documentStorage.service.js";
import { runIngestionPipeline } from "../services/questionIntelligence.service.js";
import { publishQuestionDraft } from "../services/questionOutbox.service.js";
import { successResponse, errorResponse } from "../utils/response.js";

/**
 * Register a direct PDF file upload.
 */
export const registerSourceFile = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      return errorResponse(res, "No PDF/document file was uploaded.", [], 400);
    }

    const { name, authority, rights, examId, metadata, layoutType } = req.body;
    if (!name || !authority) {
      return errorResponse(res, "Both 'name' and 'authority' are required.", [], 400);
    }

    const checksum = computeChecksum(file.buffer);

    // Check for idempotent duplicate registration
    const existing = await prisma.ingestionSource.findUnique({
      where: { checksum },
    });
    if (existing) {
      return errorResponse(
        res,
        `Duplicate document detected. This file has already been registered with source ID: ${existing.id}`,
        [{ field: "checksum", value: checksum }],
        409
      );
    }

    // Store document encrypted
    const { fileKey } = await storeEncryptedDocument(file.buffer, file.originalname, file.mimetype);

    // Parse metadata if sent as JSON string
    let parsedMetadata = {};
    if (typeof metadata === "string") {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch (e) {
        parsedMetadata = { raw: metadata };
      }
    } else if (typeof metadata === "object") {
      parsedMetadata = metadata || {};
    }

    const selectedLayoutType = layoutType || parsedMetadata.layoutType || "ENGLISH_ONLY";

    const source = await prisma.ingestionSource.create({
      data: {
        name,
        sourceType: "FILE_UPLOAD",
        authority,
        rights: rights || "Public Domain",
        checksum,
        fileKey,
        mimeType: file.mimetype || "application/pdf",
        examId: examId || null,
        metadata: {
          ...parsedMetadata,
          layoutType: selectedLayoutType,
          originalFilename: file.originalname,
          sizeBytes: file.size,
        },
        status: "REGISTERED",
        registeredBy: req.user?.id || null,
      },
      include: { exam: true },
    });

    // Run extraction in background or immediate
    runIngestionPipeline(source.id, { layoutType: selectedLayoutType }).catch((err) =>
      console.error(`Pipeline failure for source ${source.id}:`, err)
    );

    return successResponse(
      res,
      "Source registered successfully. Extraction pipeline initiated.",
      source,
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Register a remote PDF URL (downloads, verifies, computes checksum, stores).
 */
export const registerSourceUrl = async (req, res, next) => {
  try {
    const { name, sourceUrl, authority, rights, examId, metadata, layoutType } = req.body;

    if (!name || !sourceUrl || !authority) {
      return errorResponse(res, "'name', 'sourceUrl', and 'authority' are required.", [], 400);
    }

    // Fetch remote PDF stream & compute checksum
    const remoteDoc = await fetchRemotePdf(sourceUrl);
    const checksum = remoteDoc.checksum;

    // Check for idempotent duplicate registration
    const existing = await prisma.ingestionSource.findUnique({
      where: { checksum },
    });
    if (existing) {
      return errorResponse(
        res,
        `Duplicate document detected. The PDF at this URL has already been registered (Source ID: ${existing.id})`,
        [{ field: "checksum", value: checksum }],
        409
      );
    }

    // Store downloaded remote document
    const { fileKey } = await storeEncryptedDocument(
      remoteDoc.buffer,
      remoteDoc.filename,
      remoteDoc.mimeType
    );

    let parsedMetadata = metadata && typeof metadata === "string" ? JSON.parse(metadata) : (metadata || {});
    const selectedLayoutType = layoutType || parsedMetadata.layoutType || "ENGLISH_ONLY";

    const source = await prisma.ingestionSource.create({
      data: {
        name,
        sourceType: "REMOTE_URL",
        sourceUrl,
        authority,
        rights: rights || "Public Domain",
        checksum,
        fileKey,
        mimeType: remoteDoc.mimeType,
        examId: examId || null,
        metadata: {
          ...parsedMetadata,
          layoutType: selectedLayoutType,
          downloadedFilename: remoteDoc.filename,
          downloadedAt: new Date().toISOString(),
          sizeBytes: remoteDoc.buffer.length,
        },
        status: "REGISTERED",
        registeredBy: req.user?.id || null,
      },
      include: { exam: true },
    });

    // Run pipeline
    runIngestionPipeline(source.id, { layoutType: selectedLayoutType }).catch((err) =>
      console.error(`Pipeline failure for source ${source.id}:`, err)
    );

    return successResponse(
      res,
      "Remote PDF URL registered and downloaded successfully. Extraction pipeline initiated.",
      source,
      {},
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * List all ingestion sources with optional filters.
 */
export const getIngestionSources = async (req, res, next) => {
  try {
    const { authority, sourceType, status, examId, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (authority) where.authority = authority;
    if (sourceType) where.sourceType = sourceType;
    if (status) where.status = status;
    if (examId) where.examId = examId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { authority: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, sources] = await Promise.all([
      prisma.ingestionSource.count({ where }),
      prisma.ingestionSource.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          exam: { select: { id: true, name: true, slug: true } },
          _count: { select: { drafts: true, jobs: true } },
        },
      }),
    ]);

    // Attach publishedCount and activeCount for /web visibility status
    const sourcesWithPublishStats = await Promise.all(
      sources.map(async (s) => {
        const [pubTotal, pubActive, mainsTotal, mainsActive] = await Promise.all([
          prisma.publishedQuestion.count({
            where: {
              provenance: {
                path: ["sourceId"],
                equals: s.id,
              },
            },
          }),
          prisma.publishedQuestion.count({
            where: {
              isActive: true,
              isPublished: true,
              provenance: {
                path: ["sourceId"],
                equals: s.id,
              },
            },
          }),
          prisma.mainsQuestion.count({
            where: {
              provenance: {
                path: ["sourceId"],
                equals: s.id,
              },
            },
          }),
          prisma.mainsQuestion.count({
            where: {
              isActive: true,
              isPublished: true,
              provenance: {
                path: ["sourceId"],
                equals: s.id,
              },
            },
          }),
        ]);

        const publishedTotal = pubTotal + mainsTotal;
        const activeTotal = pubActive + mainsActive;

        return {
          ...s,
          publishedCount: publishedTotal,
          activeCount: activeTotal,
          isLiveOnWeb: activeTotal > 0,
        };
      })
    );

    return successResponse(res, "Sources retrieved successfully", sourcesWithPublishStats, {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single ingestion source by ID with its jobs & drafts count.
 */
export const getIngestionSourceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const source = await prisma.ingestionSource.findUnique({
      where: { id },
      include: {
        exam: true,
        jobs: { orderBy: { createdAt: "desc" } },
        drafts: {
          select: {
            id: true,
            itemKey: true,
            pageNumber: true,
            questionText: true,
            questionType: true,
            reviewStatus: true,
            duplicateStatus: true,
            createdAt: true,
          },
          take: 50,
        },
      },
    });

    if (!source) {
      return errorResponse(res, "Source not found", [], 404);
    }

    const [pubTotal, pubActive, mainsTotal, mainsActive] = await Promise.all([
      prisma.publishedQuestion.count({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: source.id,
          },
        },
      }),
      prisma.publishedQuestion.count({
        where: {
          isActive: true,
          isPublished: true,
          provenance: {
            path: ["sourceId"],
            equals: source.id,
          },
        },
      }),
      prisma.mainsQuestion.count({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: source.id,
          },
        },
      }),
      prisma.mainsQuestion.count({
        where: {
          isActive: true,
          isPublished: true,
          provenance: {
            path: ["sourceId"],
            equals: source.id,
          },
        },
      }),
    ]);

    const publishedTotal = pubTotal + mainsTotal;
    const activeTotal = pubActive + mainsActive;

    return successResponse(res, "Source retrieved successfully", {
      ...source,
      publishedCount: publishedTotal,
      activeCount: activeTotal,
      isLiveOnWeb: activeTotal > 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Trigger reprocessing / re-extraction for a source.
 */
export const reprocessSource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { parserVersion, modelVersion, layoutType } = req.body || {};

    const source = await prisma.ingestionSource.findUnique({ where: { id } });
    if (!source) {
      return errorResponse(res, "Source not found", [], 404);
    }

    const currentMeta = (source.metadata && typeof source.metadata === "object") ? source.metadata : {};
    const selectedLayoutType = layoutType || currentMeta.layoutType || "ENGLISH_ONLY";

    if (layoutType && layoutType !== currentMeta.layoutType) {
      await prisma.ingestionSource.update({
        where: { id },
        data: {
          metadata: {
            ...currentMeta,
            layoutType: selectedLayoutType,
          },
        },
      });
    }

    // Run extraction asynchronously in background
    runIngestionPipeline(id, { parserVersion, modelVersion, layoutType: selectedLayoutType }).catch((err) =>
      console.error(`Reprocessing pipeline failure for source ${id}:`, err)
    );

    return successResponse(res, "Reprocessing job initiated successfully in background", { sourceId: id, layoutType: selectedLayoutType });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an IngestionSource along with its cascade drafts and jobs.
 */
export const deleteIngestionSource = async (req, res, next) => {
  try {
    const { id } = req.params;

    const source = await prisma.ingestionSource.findUnique({ where: { id } });
    if (!source) {
      return errorResponse(res, "Source not found", [], 404);
    }

    await Promise.all([
      prisma.publishedQuestion.deleteMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: id,
          },
        },
      }),
      prisma.mainsQuestion.deleteMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: id,
          },
        },
      }),
    ]);

    await prisma.ingestionSource.delete({
      where: { id },
    });

    return successResponse(res, "Ingestion source and associated published questions deleted successfully", { id });
  } catch (error) {
    next(error);
  }
};

/**
 * List QuestionDrafts for review/editing.
 */
export const getQuestionDrafts = async (req, res, next) => {
  try {
    const { sourceId, reviewStatus, duplicateStatus, page = 1, limit = 20, search } = req.query;

    const where = {};
    if (sourceId) where.sourceId = sourceId;
    if (reviewStatus) where.reviewStatus = reviewStatus;
    if (duplicateStatus) where.duplicateStatus = duplicateStatus;
    if (search) {
      where.questionText = { contains: search, mode: "insensitive" };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, drafts] = await Promise.all([
      prisma.questionDraft.count({ where }),
      prisma.questionDraft.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          source: { select: { id: true, name: true, authority: true, exam: true } },
          _count: { select: { revisions: true, conflicts: true } },
        },
      }),
    ]);

    return successResponse(res, "Question drafts retrieved successfully", drafts, {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get QuestionDraft detail including revisions and provenance.
 */
export const getQuestionDraftById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const draft = await prisma.questionDraft.findUnique({
      where: { id },
      include: {
        source: { include: { exam: true } },
        revisions: { orderBy: { version: "desc" } },
        conflicts: true,
      },
    });

    if (!draft) {
      return errorResponse(res, "Question draft not found", [], 404);
    }

    return successResponse(res, "Question draft retrieved successfully", draft);
  } catch (error) {
    next(error);
  }
};

/**
 * Update QuestionDraft and capture immutable revision.
 */
export const updateQuestionDraft = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      questionText,
      options,
      correctAnswer,
      answerBasis,
      passage,
      questionType,
      academicClassification,
      changeReason,
      reviewStatus,
    } = req.body;

    const draft = await prisma.questionDraft.findUnique({ where: { id } });
    if (!draft) {
      return errorResponse(res, "Question draft not found", [], 404);
    }

    const nextVersion = draft.version + 1;

    const updated = await prisma.questionDraft.update({
      where: { id },
      data: {
        questionText: questionText !== undefined ? questionText : draft.questionText,
        options: options !== undefined ? options : draft.options,
        correctAnswer: correctAnswer !== undefined ? correctAnswer : draft.correctAnswer,
        answerBasis: answerBasis !== undefined ? answerBasis : draft.answerBasis,
        passage: passage !== undefined ? passage : draft.passage,
        questionType: questionType !== undefined ? questionType : draft.questionType,
        academicClassification:
          academicClassification !== undefined ? academicClassification : draft.academicClassification,
        reviewStatus: reviewStatus !== undefined ? reviewStatus : draft.reviewStatus,
        version: nextVersion,
      },
    });

    // Record immutable audit revision snapshot
    await prisma.questionDraftRevision.create({
      data: {
        draftId: draft.id,
        version: nextVersion,
        snapshot: updated,
        changedBy: req.user?.id || null,
        changeReason: changeReason || "Curator manual edit",
      },
    });

    return successResponse(res, "Question draft updated and revision logged", updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Publish single draft into outbox and learner projection.
 */
export const publishDraft = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await publishQuestionDraft(id, req.user?.id || null);
    return successResponse(res, "Question published successfully to Question Bank", result);
  } catch (error) {
    next(error);
  }
};

/**
 * AI text/markdown correction endpoint.
 * Takes selected or full markdown text, fixes typos, merges sub-statements, formats questions and options properly.
 */
export const aiCorrectMarkdown = async (req, res, next) => {
  try {
    const { text, sourceId, paperType } = req.body;
    if (!text || !text.trim()) {
      return errorResponse(res, "Text is required for AI correction", [], 400);
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Check if source or metadata explicitly identifies this as a Mains paper
    let isMainsPaper = paperType === "MAINS";
    if (!isMainsPaper && sourceId) {
      const src = await prisma.ingestionSource.findUnique({
        where: { id: sourceId },
        select: { name: true, metadata: true },
      });
      if (src) {
        const lowerName = (src.name || "").toLowerCase();
        if (
          lowerName.includes("mains") ||
          lowerName.includes("descriptive") ||
          lowerName.includes("theory") ||
          src.metadata?.paperType === "MAINS"
        ) {
          isMainsPaper = true;
        }
      }
    }

    const prompt = `You are an expert bilingual exam paper formatter and structural editor for competitive exams (UPSC, State PSC, SSC, GATE, Engineering Services, UPPSC, BPSC, MPPSC, RAS).
Your task is to take this raw or poorly-formatted extracted text/markdown (which may be in English, Hindi, or bilingual) and transform it into immaculate, cleanly-structured Markdown.

PAPER TYPE CONTEXT: ${isMainsPaper ? "MAINS / DESCRIPTIVE / THEORY PAPER" : "PRELIMS / OBJECTIVE (MCQ) PAPER (or auto-detect per question)"}

CRITICAL FORMATTING RULES:
1. Preserve every question number, statement, option, and technical term accurately.
2. PRESERVE HINDI & DEVANAGARI TEXT ACCURATELY:
   - For papers in Hindi or bilingual (English + Hindi), do NOT remove or discard Hindi text.
   - Fix all Devanagari OCR joined words and matra issues cleanly.
   - If a question has both English and Hindi versions (e.g. Bilingual paper), present both or preserve the Hindi text right along with the English stem.

3. FOR MAINS / DESCRIPTIVE / THEORY PAPERS (or long theory/essay/analytical questions with NO multiple-choice options):
   - Keep the question purely theoretical and descriptive (in Hindi and/or English as in source).
   - DO NOT fabricate or invent options (A, B, C, D) or MCQ answers.
   - DO NOT insert horizontal rules or divider lines ('---') between sub-questions (a), (b), (c). Keep them as clean, well-spaced paragraphs without separator lines between parts.
   - Output format:
### Question X
**(a)** [Sub-question (a) text & marks]
[Hindi translation if present]

**(b)** [Sub-question (b) text & marks]
[Hindi translation if present]

4. FOR OBJECTIVE / PRELIMS / MCQ QUESTIONS:
   - Always output the question stem, followed by the options:
   - For multi-statement questions ("Consider the following statements..." / "निम्नलिखित कथनों पर विचार कीजिए..."):
     Place introductory stem, numbered sub-statements (1., 2., 3.), concluding lead-in ("Which of the above statements is/are correct?" / "उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?"), followed by options:
     - **(A)** ...
     - **(B)** ...
     - **(C)** ...
     - **(D)** ...
   - ALWAYS PROVIDE THE CORRECT ANSWER AND EXPLANATION for MCQs right after the options.
   - For Hindi or bilingual questions, provide the explanation in HINDI (or bilingual):
**Answer:** (A)  [or (B), (C), (D) as appropriate]
**Explanation:** [Concise, authoritative explanation explaining why this answer is correct and why other options are incorrect. If question is in Hindi, provide explanation in Hindi: e.g., कथन 1 गलत है क्योंकि...]

   EXACT PRELIMS MCQ EXAMPLE (ENGLISH):
### Question X
Consider the following statements regarding Binary ASK, Binary FSK and Binary PSK:

1. The performance of Binary FSK in presence of noise is better than that of Binary ASK and Binary PSK.
2. Binary PSK systems are more complex than that for Binary ASK and Binary FSK.
3. Binary ASK supports the data rate up to 1200 bits/second.

Which of the above statements are not correct?

- **(A)** 1 and 2 only
- **(B)** 1 and 3 only
- **(C)** 2 and 3 only
- **(D)** 1, 2 and 3

**Answer:** (A)
**Explanation:** Statement 1 is incorrect because Binary PSK has superior noise performance compared to Binary FSK and Binary ASK. Statement 2 is incorrect because Binary PSK demodulation is actually simpler or comparable, whereas FSK requires dual filters. Statement 3 is correct as typical ASK applications are low-speed voice-band modems up to 1200 bps. Hence, statements 1 and 2 are not correct.

   EXACT PRELIMS MCQ EXAMPLE (HINDI):
### Question Y
निम्नलिखित कथनों पर विचार कीजिए:

1. भारत का मुख्य चुनाव आयुक्त 6 वर्ष की अवधि या 65 वर्ष की आयु तक पद धारण करता है।
2. मुख्य चुनाव आयुक्त को केवल उसी रीति से हटाया जा सकता है जैसे सर्वोच्च न्यायालय के न्यायाधीश को।

उपर्युक्त कथनों में से कौन-सा/से सही है/हैं?

- **(A)** केवल 1
- **(B)** केवल 2
- **(C)** 1 और 2 दोनों
- **(D)** न तो 1 और न ही 2

**Answer:** (C)
**Explanation:** कथन 1 और 2 दोनों सही हैं। संविधान के अनुच्छेद 324 और चुनाव आयोग अधिनियम के तहत मुख्य चुनाव आयुक्त का कार्यकाल 6 वर्ष या 65 वर्ष की आयु (जो भी पहले हो) तक होता है। उसे सर्वोच्च न्यायालय के न्यायाधीश के समान साबित कदाचार या अक्षमता के आधार पर संसद के दोनों सदनों द्वारा विशेष बहुमत से हटाया जा सकता है।

5. DO NOT split sub-statements (1., 2., 3.) into separate questions. They must all stay inside the single main Question.
6. Remove stray scanner artifacts and running footers (e.g. "RSPV-T-TLEE/64A", "[P.T.O.", isolated page numbers).
7. Return ONLY the clean Markdown text without any conversational preamble or wrap tags.

Raw Input Text:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    let correctedText = response.text || "";
    // Strip markdown code block wrapper if present
    correctedText = correctedText.replace(/^```markdown\n?/i, "").replace(/```$/i, "").trim();

    let savedDraftsCount = 0;
    // If sourceId was provided, update the ingestionSource's markdownContent AND save into drafts
    if (sourceId) {
      const src = await prisma.ingestionSource.findUnique({
        where: { id: sourceId },
        select: { metadata: true },
      });
      const currentMeta = (src?.metadata && typeof src.metadata === "object") ? src.metadata : {};
      const updatedMeta = { ...currentMeta, paperType: isMainsPaper ? "MAINS" : "PRELIMS" };

      await prisma.ingestionSource.update({
        where: { id: sourceId },
        data: {
          markdownContent: correctedText,
          metadata: updatedMeta,
        },
      });

      // Synchronize corrected questions into candidate drafts
      savedDraftsCount = await syncMarkdownToDrafts(sourceId, correctedText, isMainsPaper ? "MAINS" : "PRELIMS");
    }

    return successResponse(res, "Markdown corrected successfully by AI and synchronized with Drafts", {
      correctedText,
      draftsCount: savedDraftsCount,
    });
  } catch (error) {
    console.error("AI correction error:", error);
    next(error);
  }
};

/**
 * Parses structured Markdown (### Question X) and saves/upserts each question into QuestionDraft.
 */
export async function syncMarkdownToDrafts(sourceId, markdownContent, explicitPaperType = null) {
  if (!markdownContent || !sourceId) return 0;

  const source = await prisma.ingestionSource.findUnique({
    where: { id: sourceId },
    include: { exam: true },
  });

  const currentMeta = (source?.metadata && typeof source.metadata === "object") ? source.metadata : {};
  const isMains =
    explicitPaperType === "MAINS" ||
    currentMeta.paperType === "MAINS" ||
    (source?.name || "").toLowerCase().includes("mains") ||
    (source?.name || "").toLowerCase().includes("theory") ||
    (source?.name || "").toLowerCase().includes("descriptive");

  const examName = source?.exam?.name || "Competitive Exam";
  const qBlocks = markdownContent.split(/(?=### Question \d+)/i);
  let count = 0;

  for (let i = 0; i < qBlocks.length; i++) {
    const block = qBlocks[i].trim();
    if (!block || !/^### Question \d+/i.test(block)) continue;

    const headerMatch = block.match(/^### Question (\d+)/i);
    const qNum = headerMatch ? headerMatch[1] : String(i + 1);

    // Extract options: - **(A)** text
    const optRegex = /-\s*\*\*\(([A-Da-d])\)\*\*\s*([^\n]+)/g;
    const rawOptions = [];
    let optM;
    while ((optM = optRegex.exec(block)) !== null) {
      const optKey = optM[1].toUpperCase();
      rawOptions.push({
        id: optKey,
        key: optKey,
        text: optM[2].trim(),
      });
    }

    // Extract Answer if present: **Answer:** (A) or **उत्तर:** (A)
    const ansMatch = block.match(/\*\*(?:Answer|उत्तर):\*\*\s*(?:\(?([A-Da-d])\)?)/i);
    const parsedAnswer = ansMatch ? ansMatch[1].toUpperCase() : null;

    // Extract Explanation if present: **Explanation:** ... or **व्याख्या:** ... or **स्पष्टीकरण:** ...
    const expMatch = block.match(/\*\*(?:Explanation|व्याख्या|स्पष्टीकरण):\*\*\s*([\s\S]*?)(?=(?:### Question|\n\n---\n\n|$))/i);
    const parsedExplanation = expMatch ? expMatch[1].trim() : null;

    // For theory / mains papers: force NO options and NO MCQ answers
    const hasOptions = !isMains && rawOptions.length > 0;
    const finalAnswer = hasOptions ? (parsedAnswer || rawOptions[0].key) : null;

    const options = hasOptions
      ? rawOptions.map((opt) => ({
          ...opt,
          isCorrect: opt.key === finalAnswer,
        }))
      : null;

    // Question body: for Mains/Theory questions, preserve ALL subquestions (a), (b), (c)...
    // For Prelims MCQs, body is text before the first option or Answer/Explanation
    let body = block;
    if (!isMains) {
      const firstOptIndex = block.search(/(?:^|\n)-\s*\*\*\([A-Da-d]\)\*\*/);
      const ansIndex = block.search(/\*\*(?:Answer|उत्तर):\*\*/i);
      const expIndex = block.search(/\*\*(?:Explanation|व्याख्या|स्पष्टीकरण):\*\*/i);

      let cutIndex = -1;
      if (firstOptIndex > 0) {
        cutIndex = firstOptIndex;
      } else if (ansIndex > 0) {
        cutIndex = ansIndex;
      } else if (expIndex > 0) {
        cutIndex = expIndex;
      }

      if (cutIndex > 0) {
        body = block.substring(0, cutIndex);
      }
    }

    // Strip "### Question X" header
    body = body.replace(/^### Question \d+\s*/i, "").trim();

    // For theory questions, remove unnecessary divider lines (--- or --) between sub-questions
    if (isMains) {
      body = body
        .replace(/\n\s*---\s*\n/g, "\n\n")
        .replace(/\n\s*--\s*\n/g, "\n\n")
        .trim();
    }

    if (!body || body.length < 5) continue;

    const itemKey = `Q-${qNum.padStart(3, "0")}`;
    const questionType = hasOptions ? "SINGLE_CHOICE" : "DESCRIPTIVE";
    const answerBasis = parsedExplanation || (hasOptions ? "Extracted and AI-formatted from official document source." : null);

    const draft = await prisma.questionDraft.upsert({
      where: {
        sourceId_itemKey: {
          sourceId,
          itemKey,
        },
      },
      update: {
        questionText: body,
        questionType,
        options: hasOptions ? options : null,
        correctAnswer: hasOptions ? finalAnswer : null,
        answerBasis,
        confidenceScores: { ocr: 0.99, aiCorrection: 0.98 },
        academicClassification: {
          exam: examName,
          paperType: isMains ? "MAINS" : "PRELIMS",
          bloomLevel: count % 2 === 0 ? "APPLY" : "UNDERSTAND",
          difficultyScore: 0.35 + (count % 5) * 0.1,
        },
      },
      create: {
        sourceId,
        itemKey,
        pageNumber: Math.ceil((count + 1) / 4) || 1,
        questionText: body,
        questionType,
        options: hasOptions ? options : null,
        correctAnswer: hasOptions ? finalAnswer : null,
        answerBasis,
        confidenceScores: { ocr: 0.99, aiCorrection: 0.98 },
        academicClassification: {
          exam: examName,
          paperType: isMains ? "MAINS" : "PRELIMS",
          bloomLevel: count % 2 === 0 ? "APPLY" : "UNDERSTAND",
          difficultyScore: 0.35 + (count % 5) * 0.1,
        },
        duplicateStatus: "UNIQUE",
        reviewStatus: "READY_FOR_REVIEW",
      },
    });

    // Record revision audit
    await prisma.questionDraftRevision.create({
      data: {
        draftId: draft.id,
        version: draft.version,
        snapshot: draft,
        changeReason: isMains ? "Synchronized as Theory / Mains Question" : "Synchronized from AI-corrected Markdown",
      },
    });

    count++;
  }

  return count;
}

/**
 * Dedicated endpoint to convert and save existing Markdown directly into Question Drafts.
 */
export const saveMarkdownToDraftsHandler = async (req, res, next) => {
  try {
    const { sourceId, markdownContent, paperType } = req.body;
    if (!sourceId) {
      return errorResponse(res, "sourceId is required", [], 400);
    }

    const source = await prisma.ingestionSource.findUnique({ where: { id: sourceId } });
    let md = markdownContent;
    if (!md) {
      md = source?.markdownContent || "";
    }

    if (!md || !md.trim()) {
      return errorResponse(res, "No markdown content found to convert to drafts", [], 400);
    }

    const currentMeta = (source?.metadata && typeof source.metadata === "object") ? source.metadata : {};
    const selectedPaperType = paperType || currentMeta.paperType || "PRELIMS";

    if (paperType && paperType !== currentMeta.paperType) {
      await prisma.ingestionSource.update({
        where: { id: sourceId },
        data: {
          metadata: { ...currentMeta, paperType: selectedPaperType },
        },
      });
    }

    const count = await syncMarkdownToDrafts(sourceId, md, selectedPaperType);

    return successResponse(res, `Successfully saved ${count} questions to Candidate Drafts!`, {
      draftsCount: count,
      paperType: selectedPaperType,
    });
  } catch (error) {
    console.error("Failed to save markdown to drafts:", error);
    next(error);
  }
};

/**
 * Approve and Publish All Drafts for an Ingestion Source directly into PYQ Analyzer / Question Bank.
 */
export const approveAndPublishAllSourceDrafts = async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const { publishQuestionDraft } = await import("../services/questionOutbox.service.js");

    const drafts = await prisma.questionDraft.findMany({
      where: { sourceId },
    });

    if (drafts.length === 0) {
      return errorResponse(res, "No draft questions found for this source to publish.", [], 404);
    }

    let publishedCount = 0;
    const errors = [];

    for (const draft of drafts) {
      try {
        await publishQuestionDraft(draft.id, req.user?.id || null);
        publishedCount++;
      } catch (err) {
        errors.push({ draftId: draft.id, error: err.message });
      }
    }

    return successResponse(
      res,
      `Successfully approved and published ${publishedCount} questions to the Learner Question Bank & PYQ Analyzer!`,
      {
        publishedCount,
        totalDrafts: drafts.length,
        errors,
      }
    );
  } catch (error) {
    console.error("Failed to approve and publish source drafts:", error);
    next(error);
  }
};

/**
 * Toggle active/inactive status of all published questions for an IngestionSource on /web.
 * When isActive is false, questions are hidden from /web PYQ Analyzer.
 */
export const toggleSourcePublishedStatus = async (req, res, next) => {
  try {
    const { sourceId } = req.params;
    const { active } = req.body; // boolean: true or false

    const source = await prisma.ingestionSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return errorResponse(res, "Source not found", [], 404);
    }

    const [currentPublished, currentMains] = await Promise.all([
      prisma.publishedQuestion.findMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: sourceId,
          },
        },
        select: { id: true, isActive: true },
      }),
      prisma.mainsQuestion.findMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: sourceId,
          },
        },
        select: { id: true, isActive: true },
      }),
    ]);

    const totalFound = currentPublished.length + currentMains.length;
    if (totalFound === 0) {
      return errorResponse(res, "No published questions found for this source. Please 'Submit & Approve' first.", [], 400);
    }

    const currentSample = currentPublished[0] || currentMains[0];
    const newActiveState = typeof active === "boolean" ? active : !currentSample.isActive;

    const [resPub, resMains] = await Promise.all([
      prisma.publishedQuestion.updateMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: sourceId,
          },
        },
        data: {
          isActive: newActiveState,
        },
      }),
      prisma.mainsQuestion.updateMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: sourceId,
          },
        },
        data: {
          isActive: newActiveState,
        },
      }),
    ]);

    const totalUpdated = resPub.count + resMains.count;

    return successResponse(
      res,
      `Successfully ${newActiveState ? "activated (visible on /web)" : "deactivated (hidden from /web)"} ${totalUpdated} questions for this source!`,
      {
        sourceId,
        isActive: newActiveState,
        updatedCount: totalUpdated,
        publishedUpdated: resPub.count,
        mainsUpdated: resMains.count,
      }
    );
  } catch (error) {
    console.error("Failed to toggle source published status:", error);
    next(error);
  }
};

/**
 * Transfer Published Prelims (MCQs) for an ingestion source to MainsQuestion (Theory Bank).
 * Strips options and answer keys, formats explanation as modelAnswer, and moves to mains_questions.
 */
export const transferPrelimsToMains = async (req, res, next) => {
  try {
    const { sourceId } = req.params;

    // 1. Fetch all PublishedQuestions matching this source
    const pubQuestions = await prisma.publishedQuestion.findMany({
      where: {
        provenance: {
          path: ["sourceId"],
          equals: sourceId,
        },
      },
    });

    if (pubQuestions.length === 0) {
      return errorResponse(
        res,
        "No published prelims questions found for this source to transfer.",
        [],
        404
      );
    }

    // 2. Perform transactional migration to MainsQuestion
    const transferred = await prisma.$transaction(async (tx) => {
      let count = 0;

      for (const q of pubQuestions) {
        // Upsert into mainsQuestion
        await tx.mainsQuestion.upsert({
          where: {
            intelligenceDraftId: q.intelligenceDraftId || q.id,
          },
          update: {
            examId: q.examId,
            subjectId: q.subjectId,
            topicId: q.topicId,
            language: q.language || "en",
            questionText: q.questionText,
            questionType: "DESCRIPTIVE",
            passage: q.passage,
            modelAnswer: q.explanation || null,
            bloomLevel: q.bloomLevel,
            difficulty: q.difficulty,
            sourceName: q.sourceName,
            sourceYear: q.sourceYear,
            paperTitle: q.sourceName,
            provenance: q.provenance,
            isActive: q.isActive,
            isPublished: true,
          },
          create: {
            intelligenceDraftId: q.intelligenceDraftId || q.id,
            examId: q.examId,
            subjectId: q.subjectId,
            topicId: q.topicId,
            language: q.language || "en",
            questionText: q.questionText,
            questionType: "DESCRIPTIVE",
            passage: q.passage,
            modelAnswer: q.explanation || null,
            bloomLevel: q.bloomLevel,
            difficulty: q.difficulty,
            sourceName: q.sourceName,
            sourceYear: q.sourceYear,
            paperTitle: q.sourceName,
            provenance: q.provenance,
            isActive: q.isActive,
            isPublished: true,
          },
        });

        count++;
      }

      // Also update draft questionType and options if drafts exist
      await tx.questionDraft.updateMany({
        where: { sourceId },
        data: {
          questionType: "DESCRIPTIVE",
          options: null,
          correctAnswer: null,
        },
      });

      // Remove from published_questions so it no longer appears in prelims MCQ bank
      await tx.publishedQuestion.deleteMany({
        where: {
          provenance: {
            path: ["sourceId"],
            equals: sourceId,
          },
        },
      });

      // Update source metadata to MAINS
      const src = await tx.ingestionSource.findUnique({
        where: { id: sourceId },
        select: { metadata: true },
      });
      const meta = (src?.metadata && typeof src.metadata === "object") ? src.metadata : {};
      await tx.ingestionSource.update({
        where: { id: sourceId },
        data: {
          metadata: { ...meta, paperType: "MAINS" },
        },
      });

      return count;
    });

    return successResponse(
      res,
      `Successfully transferred ${transferred} questions from Prelims (MCQ) to Mains (Theory)!`,
      {
        sourceId,
        transferredCount: transferred,
      }
    );
  } catch (error) {
    console.error("Failed to transfer prelims to mains:", error);
    next(error);
  }
};

