import { GoogleGenAI } from "@google/genai";

function cleanJsonResponse(rawText) {
  let text = (rawText || "").trim();
  if (text.startsWith("```json")) text = text.substring(7);
  else if (text.startsWith("```")) text = text.substring(3);
  if (text.endsWith("```")) text = text.substring(0, text.length - 3);
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Failed to parse JSON response:", text);
    return null;
  }
}

export async function evaluateMainsAnswer(topic, text, plan, upsc_section = "gs", target_words = 250) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured on backend");
  }

  const systemInstruction = `You are an expert UPSC Civil Services Examination (CSE) Mains Answer & Essay Senior Evaluator.
Evaluate candidate submissions strictly according to official UPSC CSE rubrics:
1. Deconstruction of directive (Discuss, Critically Analyze, Examine, Elucidate, Evaluate).
2. Multi-dimensional breadth (PESTLE: Political, Economic, Socio-Cultural, Technological, Legal, Environmental).
3. Authoritative citations (Constitutional Articles, Supreme Court Landmarks, Law Commission, NITI Aayog, Committees).
4. Balanced dialectical synthesis and forward-looking conclusion with SDG / Constitutional morality linkages.
Return output strictly as valid JSON matching the requested schema.`;

  const prompt = `Evaluate the following UPSC Mains Answer submission:
Question / Topic: "${topic}"
UPSC Paper / Section: ${upsc_section}
Target Words: ${target_words}

Student Draft:
"""
${text}
"""

Plan / Model Context:
${plan ? JSON.stringify(plan) : "None provided"}

Please return a valid JSON object matching this structure:
{
  "overall_band": "Distinguished (Top 5%)",
  "score_estimate_range": "8.5-10.0",
  "overall_360_index": 86,
  "pillars_360": {
    "directive_precision": 88,
    "substantive_authority": 84,
    "multidimensional_pestle": 82,
    "examiner_impression_index": 85,
    "visual_scannability": 80,
    "visionary_synthesis": 86
  },
  "executive_summary": "Comprehensive analysis addressing core directive.",
  "section_specific_critique": "Solid intro and balanced arguments.",
  "hook_and_thesis_analysis": { "detected_hook_model": "Constitutional Definition", "critique": "Crisp definition provided." },
  "dialectic_synthesis_analysis": { "has_counter_argument": true, "critique": "Addressed both opportunities and institutional roadblocks." },
  "dimensional_matrix_audit": { "active_lenses": ["Constitutional", "Economic", "Judicial"], "missing_lenses": ["Grassroots / Panchayati Raj", "Technological"], "advice": "Incorporate e-governance case studies." },
  "evidence_and_thinker_grounding": { "detected_thinkers": ["Amartya Sen", "2nd ARC"], "suggested_enrichments": [{ "thinker": "Punchhi Commission", "quote_or_concept": "Cooperative Federalism", "context": "Governor discretion" }] },
  "paragraph_breakdown": [{ "paragraph_number": 1, "role": "Introduction", "critique": "Direct and relevant." }, { "paragraph_number": 2, "role": "Body Dimensions", "critique": "Substantiated with data." }],
  "examiner_recommendations": ["Use flowcharts for institutional frameworks", "Cite recent 2024-2025 committee reports"]
}`;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const parsed = cleanJsonResponse(response.text);
  if (!parsed) {
    throw new Error("Unable to parse AI evaluation response");
  }
  return parsed;
}

export async function generateMainsBrainstorm(topic, upsc_section = "gs", topic_type = "analytical", target_words = 250) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured on backend");
  }

  const prompt = `You are a Senior UPSC Mains Mentor.
Generate a structured brainstorming blueprint for this UPSC question:
Topic: "${topic}"
Section: ${upsc_section}
Target Words: ${target_words}

Return valid JSON with:
{
  "deconstruction": {
    "literal_meaning": "...",
    "core_existential_tension": "..."
  },
  "creative_hooks": [
    { "title": "Anecdote / Quote Hook", "narrative_draft": "..." }
  ],
  "dialectical_tensions": [
    { "thesis": "...", "antithesis": "..." }
  ],
  "recommended_thinkers": ["..."],
  "model_framework": {
    "introduction": "...",
    "body_pillars": ["...", "..."],
    "conclusion": "..."
  }
}`;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const parsed = cleanJsonResponse(response.text);
  if (!parsed) {
    throw new Error("Unable to parse AI brainstorm response");
  }
  return parsed;
}
