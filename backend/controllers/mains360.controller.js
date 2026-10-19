import prisma from "../config/prisma.js";
import { evaluateMainsAnswer, generateMainsBrainstorm } from "../services/mainsAiEngine.service.js";

/**
 * AI Evaluate single answer
 */
export async function evaluateAnswer(req, res, next) {
  try {
    const { topic, text, plan, upsc_section, target_words, question_number, subquestions } = req.body;
    
    // Construct rich topic if single topic is empty
    let effectiveTopic = (topic || "").trim();
    if (!effectiveTopic && Array.isArray(subquestions) && subquestions.length > 0) {
      effectiveTopic = subquestions
        .map((s) => `${s.subquestion_number || s.label || ""}: ${s.text_en || s.text || ""}`.trim())
        .filter(Boolean)
        .join("\n");
    }
    if (!effectiveTopic) {
      effectiveTopic = question_number ? `Question ${question_number}` : "UPSC Mains Question";
    }

    const effectiveText = (text || "").trim();
    if (!effectiveText) {
      return res.status(400).json({ success: false, message: "Answer text is required for evaluation" });
    }

    const evaluation = await evaluateMainsAnswer(effectiveTopic, effectiveText, plan, upsc_section, target_words);
    return res.status(200).json({ success: true, ...evaluation });
  } catch (error) {
    console.error("[MAINS 360] Evaluate Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Evaluation failed" });
  }
}

/**
 * AI Brainstorm Question Topic
 */
export async function brainstormTopic(req, res, next) {
  try {
    const { topic, upsc_section, topic_type, target_words, question_number, subquestions } = req.body;
    
    let effectiveTopic = (topic || "").trim();
    if (!effectiveTopic && Array.isArray(subquestions) && subquestions.length > 0) {
      effectiveTopic = subquestions
        .map((s) => `${s.subquestion_number || s.label || ""}: ${s.text_en || s.text || ""}`.trim())
        .filter(Boolean)
        .join("\n");
    }
    if (!effectiveTopic) {
      effectiveTopic = question_number ? `Question ${question_number}` : "UPSC Mains Question";
    }

    const brainstorm = await generateMainsBrainstorm(effectiveTopic, upsc_section, topic_type, target_words);
    return res.status(200).json({ success: true, ...brainstorm });
  } catch (error) {
    console.error("[MAINS 360] Brainstorm Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Brainstorm failed" });
  }
}

/**
 * Save full paper mock attempt & evaluation
 */
export async function saveAttempt(req, res, next) {
  try {
    const userId = req.user?.id || null;
    const {
      paperId,
      paperTitle,
      paperCode,
      totalQuestions,
      attemptedCount,
      totalMarks,
      totalMaxMarks,
      scorePct,
      timeElapsedMins,
      answersJson,
      evaluationReport,
    } = req.body;

    const attempt = await prisma.mains360Attempt.create({
      data: {
        userId,
        paperId: paperId || "sim-general",
        paperTitle: paperTitle || "Mains 360 Simulation",
        paperCode: paperCode || "GS-ALL",
        totalQuestions: totalQuestions || 0,
        attemptedCount: attemptedCount || 0,
        totalMarks: totalMarks || 0,
        totalMaxMarks: totalMaxMarks || 250,
        scorePct: scorePct || 0,
        timeElapsedMins: timeElapsedMins || 0,
        answersJson: answersJson || {},
        evaluationReport: evaluationReport || {},
        status: "COMPLETED",
      },
    });

    return res.status(201).json({ success: true, attempt });
  } catch (error) {
    console.error("[MAINS 360] Save Attempt Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to save attempt" });
  }
}

/**
 * Get user's attempts
 */
export async function getAttempts(req, res, next) {
  try {
    const userId = req.user?.id;
    const where = userId ? { userId } : {};

    const attempts = await prisma.mains360Attempt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.status(200).json({ success: true, attempts });
  } catch (error) {
    console.error("[MAINS 360] Get Attempts Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch attempts" });
  }
}

/**
 * Get mastery analytics
 */
export async function getAnalytics(req, res, next) {
  try {
    const userId = req.user?.id;
    const attempts = await prisma.mains360Attempt.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const attemptsCount = attempts.length;
    const totalEvaluated = attempts.reduce((acc, a) => acc + (a.attemptedCount || 0), 0);
    const avgScore = attemptsCount
      ? Math.round(attempts.reduce((acc, a) => acc + (a.scorePct || 0), 0) / attemptsCount)
      : 0;

    // Aggregate paper progress dynamically
    const paperMap = {
      "GS-I": { code: "GS-I", title: "Heritage, History, Geography, Society", count: 0, totalPct: 0, color: "#10B981" },
      "GS-II": { code: "GS-II", title: "Governance, Constitution, Polity, IR", count: 0, totalPct: 0, color: "#6366F1" },
      "GS-III": { code: "GS-III", title: "Economy, Agriculture, S&T, Environment", count: 0, totalPct: 0, color: "#0EA5E9" },
      "GS-IV": { code: "GS-IV", title: "Ethics, Integrity, Aptitude & Cases", count: 0, totalPct: 0, color: "#F43F5E" },
      "Essay": { code: "Essay", title: "Philosophical & Socio-Economic", count: 0, totalPct: 0, color: "#F59E0B" },
      "Optional": { code: "Optional", title: "Optional Subject Papers", count: 0, totalPct: 0, color: "#8B5CF6" },
    };

    attempts.forEach((a) => {
      const codeUpper = (a.paperCode || a.paperTitle || "").toUpperCase();
      let targetKey = "Optional";
      if (codeUpper.includes("GS-1") || codeUpper.includes("GS-I") || codeUpper.includes("HISTORY") || codeUpper.includes("GEOGRAPHY")) {
        targetKey = codeUpper.includes("OPTIONAL") ? "Optional" : "GS-I";
      } else if (codeUpper.includes("GS-2") || codeUpper.includes("GS-II") || codeUpper.includes("POLITY") || codeUpper.includes("GOVERNANCE")) {
        targetKey = "GS-II";
      } else if (codeUpper.includes("GS-3") || codeUpper.includes("GS-III") || codeUpper.includes("ECONOMY") || codeUpper.includes("ENVIRONMENT")) {
        targetKey = "GS-III";
      } else if (codeUpper.includes("GS-4") || codeUpper.includes("GS-IV") || codeUpper.includes("ETHICS")) {
        targetKey = "GS-IV";
      } else if (codeUpper.includes("ESSAY")) {
        targetKey = "Essay";
      }

      if (paperMap[targetKey]) {
        paperMap[targetKey].count += (a.attemptedCount || 1);
        paperMap[targetKey].totalPct += (a.scorePct || 0);
      }
    });

    const paperProgress = Object.values(paperMap).map((p) => {
      const avg = p.count > 0 ? Math.round(p.totalPct / p.count) : 0;
      return {
        code: p.code,
        title: p.title,
        progress: avg > 0 ? Math.min(100, Math.max(15, avg)) : 0,
        answers: p.count,
        color: p.color,
      };
    }).filter((p) => p.answers > 0 || ["GS-I", "GS-II", "GS-III", "GS-IV", "Essay"].includes(p.code));

    // Dynamic Directive Mastery
    const directiveMastery = [
      {
        directive: "Critically Analyze",
        mastery: avgScore > 0 ? `${Math.min(95, avgScore + 5)}%` : "0%",
        status: avgScore >= 60 ? "Exemplary" : avgScore >= 40 ? "Strong" : "Needs Practice",
        desc: "Balances pro/con arguments with structural limitations.",
      },
      {
        directive: "Examine",
        mastery: avgScore > 0 ? `${Math.min(92, avgScore + 2)}%` : "0%",
        status: avgScore >= 55 ? "Strong" : "Developing",
        desc: "Probes deep into underlying causes and legal provisions.",
      },
      {
        directive: "Discuss",
        mastery: avgScore > 0 ? `${Math.min(96, avgScore + 8)}%` : "0%",
        status: avgScore >= 50 ? "Mastered" : "Developing",
        desc: "Broad multidimensional PESTLE coverage.",
      },
      {
        directive: "Evaluate",
        mastery: avgScore > 0 ? `${Math.max(10, avgScore - 6)}%` : "0%",
        status: avgScore >= 65 ? "Strong" : "Needs Practice",
        desc: "Criteria-based judgment and counter-arguments.",
      },
      {
        directive: "Elucidate / Comment",
        mastery: avgScore > 0 ? `${Math.min(90, avgScore + 3)}%` : "0%",
        status: avgScore >= 50 ? "Strong" : "Developing",
        desc: "Clarifies core quote with relevant historical anecdotes.",
      },
    ];

    return res.status(200).json({
      success: true,
      data: {
        totalEvaluated,
        avgScore,
        attemptsCount,
        recentAttempts: attempts.slice(0, 10).map((a) => ({
          id: a.id,
          paperId: a.paperId,
          paperTitle: a.paperTitle,
          paperCode: a.paperCode,
          totalQuestions: a.totalQuestions,
          attemptedCount: a.attemptedCount,
          totalMarks: a.totalMarks,
          totalMaxMarks: a.totalMaxMarks,
          scorePct: a.scorePct,
          timeElapsedMins: a.timeElapsedMins,
          createdAt: a.createdAt,
          evaluationReport: a.evaluationReport,
          answersJson: a.answersJson,
        })),
        paperProgress,
        directiveMastery,
      },
    });
  } catch (error) {
    console.error("[MAINS 360] Get Analytics Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch analytics" });
  }
}
