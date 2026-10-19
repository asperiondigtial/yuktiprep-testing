import dotenv from "dotenv";
import dns from "node:dns";
import { setGlobalDispatcher, Agent } from "undici";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Ensure Node and Undici global fetch enforce IPv4 to prevent unreachable IPv6 ETIMEDOUT errors
try {
  dns.setDefaultResultOrder("ipv4first");
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup: (hostname, opts, cb) =>
          dns.lookup(hostname, { ...opts, family: 4 }, cb),
      },
    })
  );
} catch (e) {
  console.warn("[chatbotweb.service] Failed to set IPv4 dispatcher:", e?.message);
}


/**
 * AI Study Planner Service
 * Responsible for generating personalized, practical, and exam-focused study plans using Google Gemini.
 * Follows strict security guidelines: API keys are accessed only on the server.
 */

const STUDY_PLANNER_SYSTEM_INSTRUCTION = `You are an AI Study Planner.

Your job is to create personalized, practical and exam-focused study plans.

Understand the user's:
- exam
- subject
- target
- available study time
- duration
- current preparation level
- priorities

Create structured plans with:
- daily tasks
- weekly goals
- revision
- practice questions
- mock tests
- review periods
- important priorities

Do not invent information about the user's schedule.
If important information is missing, make reasonable assumptions and clearly state them.

Keep the response easy to read in a chat interface.

Formatting & Spacing Guidelines:
- Use clean, well-spaced standard Markdown with bold headings (###, ####) and bullet points.
- Do NOT insert horizontal divider lines (--- or ***) between headings or sections.
- Ensure proper blank lines before and after headings, tables, and lists.

The user may ask follow-up questions.
Use the previous conversation to maintain context.

Works for any exam or target: UPSC, TNPSC, SSC, NEET, JEE, Banking, CAT, College exams, School exams, or any custom exam or subject.`;

const SUPPORTED_LANGUAGES = {
  hi: { english: "Hindi", native: "हिन्दी" },
  ta: { english: "Tamil", native: "தமிழ்" },
  te: { english: "Telugu", native: "తెలుగు" },
  bn: { english: "Bengali", native: "বাংলা" },
  mr: { english: "Marathi", native: "मराठी" },
  gu: { english: "Gujarati", native: "ગુજરાતી" },
  kn: { english: "Kannada", native: "ಕನ್ನಡ" },
  ml: { english: "Malayalam", native: "മലയാളം" },
  pa: { english: "Punjabi", native: "ਪੰਜਾਬੀ" },
  or: { english: "Odia", native: "ଓଡ଼ିଆ" },
  as: { english: "Assamese", native: "অসমীয়া" },
  ur: { english: "Urdu", native: "اردو" },
  ne: { english: "Nepali", native: "नेपाली" },
  en: { english: "English", native: "English" },
};

function getLanguageInstruction(languageCode) {
  if (!languageCode || typeof languageCode !== "string") return "";
  const code = languageCode.trim().toLowerCase();
  if (code === "en") return "";

  const lang = SUPPORTED_LANGUAGES[code];
  const langName = lang ? `${lang.english} (${lang.native})` : code;
  const scriptName = lang?.native ? `${lang.native} script` : `${lang?.english || code} script`;

  if (code === "hi") {
    return `CRITICAL LANGUAGE INSTRUCTION:
- The user has selected HINDI (हिन्दी) as their preferred language.
- You MUST generate your entire response in natural, fluent Hindi (हिन्दी) using the Devanagari script.
- All step-by-step explanations, concepts, shortcut tricks, questions, options, headings, and tips MUST be written in Hindi.
- Keep mathematical notations, equations, variables, and formulas intact (e.g., $x + y = 10$, $\\frac{a}{b}$, $\\text{Work} = \\text{Efficiency} \\times \\text{Time}$, etc.).
- When introducing specific technical or competitive exam terms (e.g. in Quantitative Aptitude, CSAT, Reasoning, Polity, Economics), you may include the English term in parentheses alongside the Hindi term for clarity (e.g., "कार्य क्षमता (Work Efficiency)", "समय एवं दूरी (Time & Distance)", "प्रतिशत (Percentage)").`;
  }

  return `CRITICAL LANGUAGE INSTRUCTION:
- The user has selected ${langName} as their preferred language.
- You MUST generate your entire response in natural, fluent ${langName} using the appropriate ${scriptName}.
- All step-by-step explanations, concepts, shortcut tricks, questions, options, headings, and tips MUST be written in ${lang?.english || code}.
- Keep mathematical notations, equations, variables, and formulas intact (e.g., $x + y = 10$).
- When introducing specific technical or competitive exam terms, you may include the English term in parentheses alongside the native term for clarity.`;
}

/**
 * Gets or initializes the Google Gemini AI client
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to execute Gemini operations with automatic retry on transient network/timeout errors
 */
async function executeWithRetry(operationFn, maxRetries = 2, delayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operationFn();
    } catch (err) {
      lastError = err;
      const isNetworkTimeout =
        err?.code === "ETIMEDOUT" ||
        err?.cause?.code === "ETIMEDOUT" ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("network timeout") ||
        err?.message?.includes("503") ||
        err?.status === 503;

      if (!isNetworkTimeout || attempt === maxRetries) {
        throw err;
      }

      console.warn(
        `[chatbotweb.service] Gemini request failed with ${err?.cause?.code || err?.code || err?.message}. Retrying attempt ${attempt + 1}/${maxRetries} in ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2; // exponential backoff
    }
  }
  throw lastError;
}

/**
 * Generates an educational study plan or answers follow-up study planner questions
 * @param {string} prompt - The user prompt or follow-up question
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior conversation turns
 * @param {string} language - Target language code (e.g. 'hi', 'en', 'ta')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function generateStudyPlan(prompt, conversationHistory = [], language = "en") {
  try {
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return {
        success: false,
        message: "Please provide a valid study plan goal or question.",
      };
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn("[chatbotweb.service] GEMINI_API_KEY is not configured.");
      return {
        success: false,
        message:
          "Sorry, I couldn't generate a reply right now (AI service is temporarily unavailable). Please try again in a moment.",
      };
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Format previous turns for Gemini SDK chats API
    // 1. Filter out error messages
    // 2. Strict alternating pattern: user -> model -> user -> model
    // 3. Must end with 'model' turn so chat.sendMessage(prompt) is the next 'user' turn
    const formattedHistory = [];
    if (Array.isArray(conversationHistory)) {
      let expectedRole = "user";
      for (const msg of conversationHistory) {
        if (!msg || !msg.content || typeof msg.content !== "string") continue;
        const text = msg.content.trim();
        if (!text) continue;

        if (
          text.includes("An error occurred while communicating") ||
          text.includes("Sorry, I could not generate a response") ||
          text.includes("Sorry, I couldn't generate a reply")
        ) {
          continue;
        }

        const role =
          msg.role === "assistant" || msg.role === "model" ? "model" : "user";

        if (role === expectedRole) {
          formattedHistory.push({
            role,
            parts: [{ text }],
          });
          expectedRole = role === "user" ? "model" : "user";
        } else if (formattedHistory.length > 0) {
          const lastIdx = formattedHistory.length - 1;
          formattedHistory[lastIdx].parts[0].text += `\n${text}`;
        }
      }

      while (
        formattedHistory.length > 0 &&
        formattedHistory[formattedHistory.length - 1].role === "user"
      ) {
        formattedHistory.pop();
      }
    }

    const langInstruction = getLanguageInstruction(language);
    const systemInstruction = langInstruction
      ? `${STUDY_PLANNER_SYSTEM_INSTRUCTION}\n\n${langInstruction}`
      : STUDY_PLANNER_SYSTEM_INSTRUCTION;

    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      history: formattedHistory,
    });

    const response = await executeWithRetry(() =>
      chat.sendMessage({
        message: prompt.trim(),
      })
    );

    const generatedText = response?.text;

    if (!generatedText) {
      throw new Error("No response text returned from Gemini API");
    }

    return {
      success: true,
      message: generatedText,
    };
  } catch (error) {
    console.error(
      "Gemini Study Planner Error:",
      error?.message || error,
      error?.cause
        ? `| Cause: ${error.cause?.message || JSON.stringify(error.cause)}`
        : "",
    );
    return {
      success: false,
      message:
        "Sorry, I couldn't generate a reply right now (AI service is temporarily unavailable). Please try again in a moment.",
    };
  }
}

const AI_TUTOR_SYSTEM_INSTRUCTION = `You are Yuktiprep AI, the expert AI Tutor for YuktiPrep, an exam preparation platform for competitive exams (UPSC, CSAT, State PSCs, SSC, Banking, Aptitude, etc.).

Your role is to help students as Yuktiprep AI with:

1. Explaining questions step by step with clear reasoning and shortcut tricks.
2. Generating high-yield practice tests on specific topics with questions, options, correct answers, and explanations.
3. Teaching smart shortcut tricks and time-saving techniques (especially for CSAT, Quant, and Reasoning).
4. Analyzing common candidate mistakes and giving practical improvement tips.
5. Conducting concise, comprehensive concept revisions with summaries and key takeaways.

Formatting & Spacing Guidelines (STRICT):
- Use clean, well-spaced standard Markdown with natural spacing.
- Do NOT insert horizontal divider lines (--- or ***) between headings, subheadings, or sections.
- Main headings MUST be formatted as bold Markdown headings (e.g. "### 1. What is LCM?", "### 2. Fast Ways to Calculate LCM").
- Subheadings MUST be formatted as bold Markdown subheadings (e.g. "#### Method A: Mental Math Trick", "#### Model 1: Circular Tracks").
- Never write section titles as plain unformatted text.
- Always include an empty blank line before and after headings, bullet points, code blocks, tables, and formulas.
- For mathematical expressions and formulas:
  - For inline math, use standard dollar signs like $x + y = 10$, $\\frac{a}{b}$, or $4, 8, 12, 16, 20$. Keep the math formula on the same line without breaking across multiple lines.
  - For standalone formulas or block equations, use double dollar signs on their own lines with blank lines around them:
    $$
    \\text{LCM of fractions} = \\frac{\\text{LCM of Numerators}}{\\text{HCF of Denominators}}
    $$
    $$
    \\text{Required Number} = [\\text{LCM}(x, y, z) \\times k] - D
    $$
- For ascii diagrams or alignment trees (e.g. mixture alligation), format them inside fenced code blocks (\`\`\`text ... \`\`\`) so indentation and spacing render cleanly.
- Use bold highlights (**Key Rule**, **Example:**, **Step 1:**) to make answers structured, scannable, exam-focused, and easy to read.`;

/**
 * General AI Tutor interaction for Question Explanation, Tests, Shortcuts, Mistake Analysis, and Concept Revision.
 * @param {string} prompt - The question or directive
 * @param {Array<{role: string, content: string}>} conversationHistory - Prior conversation turns
 * @param {string} language - Target language code (e.g. 'hi', 'en', 'ta')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function askAiTutor(prompt, conversationHistory = [], language = "en") {
  try {
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return {
        success: false,
        message: "Please provide a valid question or topic.",
      };
    }

    const ai = getGeminiClient();
    if (!ai) {
      console.warn("[chatbotweb.service] GEMINI_API_KEY is not configured.");
      return {
        success: false,
        message:
          "Sorry, I couldn't generate a reply right now (AI service is temporarily unavailable). Please try again in a moment.",
      };
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    // Sanitize multi-turn history for Gemini:
    // 1. Filter out error messages ("An error occurred...", "Sorry, I could not...")
    // 2. Strict alternating pattern: user -> model -> user -> model
    // 3. Must end with 'model' turn so chat.sendMessage(prompt) is the next 'user' turn
    const formattedHistory = [];
    if (Array.isArray(conversationHistory)) {
      let expectedRole = "user";
      for (const msg of conversationHistory) {
        if (!msg || !msg.content || typeof msg.content !== "string") continue;
        const text = msg.content.trim();
        if (!text) continue;

        // Skip assistant error placeholders
        if (
          text.includes("An error occurred while communicating") ||
          text.includes("Sorry, I could not generate a response") ||
          text.includes("Sorry, I couldn't generate a reply")
        ) {
          continue;
        }

        const role =
          msg.role === "assistant" || msg.role === "model" ? "model" : "user";

        if (role === expectedRole) {
          formattedHistory.push({
            role,
            parts: [{ text }],
          });
          expectedRole = role === "user" ? "model" : "user";
        } else if (formattedHistory.length > 0) {
          // If consecutive turn with same role, merge text instead of crashing
          const lastIdx = formattedHistory.length - 1;
          formattedHistory[lastIdx].parts[0].text += `\n${text}`;
        }
      }

      // Gemini chat requires history to end on 'model' turn before sendMessage('user')
      while (
        formattedHistory.length > 0 &&
        formattedHistory[formattedHistory.length - 1].role === "user"
      ) {
        formattedHistory.pop();
      }
    }

    const langInstruction = getLanguageInstruction(language);
    const systemInstruction = langInstruction
      ? `${AI_TUTOR_SYSTEM_INSTRUCTION}\n\n${langInstruction}`
      : AI_TUTOR_SYSTEM_INSTRUCTION;

    const chat = ai.chats.create({
      model: modelName,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      history: formattedHistory,
    });

    const response = await executeWithRetry(() =>
      chat.sendMessage({
        message: prompt.trim(),
      })
    );

    const generatedText = response?.text;
    if (!generatedText) {
      throw new Error("No response text returned from Gemini API");
    }

    return {
      success: true,
      message: generatedText,
    };
  } catch (error) {
    console.error(
      "Gemini AI Tutor Error:",
      error?.message || error,
      error?.cause
        ? `| Cause: ${error.cause?.message || JSON.stringify(error.cause)}`
        : "",
    );
    return {
      success: false,
      message:
        "Sorry, I couldn't generate a reply right now (AI service is temporarily unavailable). Please try again in a moment.",
    };
  }
}
