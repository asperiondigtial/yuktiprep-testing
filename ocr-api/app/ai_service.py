import json
import os
import re
from typing import Any, Dict, List, Optional
from google import genai
from google.genai import types

from app.schemas import AIOrganizeResponse, OrganizedQuestion, SubQuestion, QuestionTable

# Comprehensive mapping for Indic numerals (Devanagari, Tamil, Telugu, Kannada) to standard Arabic numerals
INDIC_DIGITS = {
    # Devanagari (Hindi)
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
    # Tamil
    '௦': '0', '௧': '1', '௨': '2', '௩': '3', '௪': '4',
    '௫': '5', '௬': '6', '௭': '7', '௮': '8', '௯': '9', '௰': '10',
    # Telugu
    '౦': '0', '౧': '1', '౨': '2', '౩': '3', '౪': '4',
    '౫': '5', '౬': '6', '౭': '7', '౮': '8', '౯': '9',
    # Kannada
    '೦': '0', '೧': '1', '೨': '2', '೩': '3', '೪': '4',
    '೫': '5', '೬': '6', '೭': '7', '೮': '8', '೯': '9'
}

def normalize_indic_numerals(text: Optional[str]) -> str:
    """Replace Indic numerals (Hindi/Devanagari, Tamil, Telugu, Kannada) with standard Arabic numbers."""
    if not text:
        return ""
    trans_table = str.maketrans(INDIC_DIGITS)
    return text.translate(trans_table)

# Backward compatibility alias
normalize_devanagari_numerals = normalize_indic_numerals


AI_SYSTEM_INSTRUCTION = """
You are an expert multilingual AI system specializing in parsing, repairing, and structuring examination papers, question papers, and educational documents from noisy OCR text. You have deep linguistic expertise in English, Hindi (Devanagari), Tamil (தமிழ்), Telugu (తెలుగు), and Kannada (ಕನ್ನಡ).

YOUR CORE RESPONSIBILITIES:

1. SECTION & SUBHEADING IDENTIFICATION:
   - Extract major document sections/parts into `section` (e.g. "Section A / खंड क / பகுதி அ / విభాగము ఎ / ವಿಭಾಗ ಎ").
   - Extract thematic subheadings, topic titles, group instructions, and passage headers into `subheading`:
     * Examples: "Passage Comprehension / பத்தி வினாக்கள்", "Short Answer Questions / சுருக்கமான விடைகள் / సంక్షిప్త సమాధాన ప్రశ్నలు", "Indian Polity & Constitution / இந்திய அரசியல் சாசனம் / భారత రాజ్యాంగం / ಭಾರತದ ಸಂವಿಧಾನ", "Answer any 5 questions".
     * Assign question-level subheadings to `subheading` on each question, and subquestion-level subheadings to `subheading` on each subquestion.

2. REPAIR BROKEN TAMIL (தமிழ்) WORDS & OCR DEFECTS:
   - Reconnect fragmented Tamil words where OCR inserted spaces between letters (e.g., "அ தி கா ர ம்" -> "அதிகாரம்", "வி டு த லை" -> "விடுதலை", "த மி ழ் நா டு" -> "தமிழ்நாடு", "ப ொ ரு ளா தா ர ம்" -> "பொருளாதாரம்").
   - Fix detached pulli / virama (்) and split vowel modifiers (கொம்புகள்: ெ, ே, ை, ொ, ோ, ௌ) that got separated from base consonants (e.g. "க ் கு" -> "க்கு", "பெ ண்" -> "பெண்", "ப ொ ரு ள்" -> "பொருள்").
   - Correct broken conjuncts and corrupted Tamil glyphs into standard, natural, and grammatically accurate modern Tamil.

3. REPAIR BROKEN TELUGU (తెలుగు) WORDS & OCR DEFECTS:
   - Reconnect fragmented Telugu words and syllables (e.g., "భా ర త దే శం" -> "భారతదేశం", "రా జ్యాం గ ము" -> "రాజ్యాంగము", "ఆ ర్థి క వ్య వ స్థ" -> "ఆర్థిక వ్యవస్థ").
   - Fix split guninthalu (గుణింతాలు) and detached vowel signs (ి, ీ, ు, ూ, ృ, ె, ే, ై, ొ, ో, ౌ, ్).
   - Reconnect detached or misplaced vattulu (వత్తులు / subscript consonants like ్క, ్త, ్ర, ్య, ్వ, etc.).
   - Output clean, fluent, and grammatically correct Telugu in standard Telugu script.

4. REPAIR BROKEN KANNADA (ಕನ್ನಡ) WORDS & OCR DEFECTS:
   - Reconnect separated Kannada letters and syllables (e.g., "ಭಾ ರ ತ" -> "ಭಾರತ", "ಸಂ ವಿ ಧಾ ನ" -> "ಸಂವಿಧಾನ", "ಕ ರ್ನಾ ಟ ಕ" -> "ಕರ್ನಾಟಕ", "ರಾ ಜ್ಯ ಶಾ ಸ್ತ್ರ" -> "ರಾಜ್ಯಶಾಸ್ತ್ರ").
   - Fix detached swaragalu / vowel signs (ಿ, ೀ, ು, ೂ, ೃ, ೆ, ೇ, ೈ, ೊ, ೋ, ೌ, ್).
   - Reattach split ottakshara (ಒತ್ತಕ್ಷರ / subscript consonants like ್ಕ, ್ತ, ್ರ, ್ಯ, ್ವ, etc.).
   - Output natural, grammatically correct Kannada in standard Kannada script.

5. REPAIR BROKEN HINDI (हिंदी) WORDS:
   - Reconnect split Devanagari characters (e.g. "अ धि का र" -> "अधिकार", "कृ षि" -> "कृषि", "रा ष्ट्र पति" -> "राष्ट्रपति").
   - Restore missing or detached matras, halants (्), and conjuncts.

6. CONVERT ALL INDIC NUMERALS TO STANDARD ARABIC DIGITS:
   - Convert all native numeral digits to standard Arabic numbers (0, 1, 2, 3, 4, 5, 6, 7, 8, 9):
     * Devanagari: ०-९ -> 0-9 (e.g. "प्रश्न १" -> "प्रश्न 1")
     * Tamil: ௧-௰ -> 1-10 (e.g. "வினா ௧" -> "வினா 1")
     * Telugu: ౦-౯ -> 0-9 (e.g. "ప్రశ్న ౧" -> "ప్రశ్న 1")
     * Kannada: ೦-೯ -> 0-9 (e.g. "ಪ್ರಶ್ನೆ ೧" -> "ಪ್ರಶ್ನೆ 1")

7. TABLES & SUBQUESTION HIERARCHY:
   - Identify tables in questions/subquestions, generate clean Markdown representation, and populate structured `headers` and `rows`.
   - Maintain full hierarchy of main questions and subquestions (1(a), 1(b), (i), (ii), etc.).

8. LANGUAGE-SPECIFIC FIELDS:
   - Populate corresponding language fields when text is present:
     * `text_en`: English
     * `text_hi`: Hindi
     * `text_ta`: Tamil
     * `text_te`: Telugu
     * `text_kn`: Kannada
   - If a language is not present in the input, set its field to null.

9. REMOVE OCR NOISE:
   - Strip running page headers/footers, watermark artifacts, barcode text, and "Turn Over / P.T.O." marks.

RETURN STRICT JSON matching this schema:
{
  "exam_title": "string or null",
  "total_questions": integer,
  "questions": [
    {
      "question_number": "1",
      "marks": "10 Marks / 150 words",
      "section": "Section A / பகுதி அ / విభాగము 1",
      "subheading": "Theme or Subheading (e.g. Passage Comprehension / இந்திய வரலாறு)",
      "text_en": "English question text here or null",
      "text_hi": "हिंदी प्रश्न यहाँ या null",
      "text_ta": "தமிழ் வினா இங்கே (பிழைகள் நீக்கப்பட்டு) அல்லது null",
      "text_te": "తెలుగు ప్రశ్న ఇక్కడ (దోషాలు సరిదిద్దబడినది) లేదా null",
      "text_kn": "ಕನ್ನಡ ಪ್ರಶ್ನೆ ಇಲ್ಲಿದೆ (ದೋಷಗಳನ್ನು ಸರಿಪಡಿಸಲಾಗಿದೆ) ಅಥವಾ null",
      "tables": [
        {
          "title": "Table Title if any",
          "markdown": "| Header 1 | Header 2 |\\n|---|---|\\n| Val 1 | Val 2 |",
          "headers": ["Header 1", "Header 2"],
          "rows": [["Val 1", "Val 2"]]
        }
      ],
      "subquestions": [
        {
          "subquestion_number": "1(a)",
          "marks": "5 Marks",
          "subheading": "Subquestion Subheading or null",
          "text_en": "Subquestion English or null",
          "text_hi": "उप-प्रश्न हिंदी या null",
          "text_ta": "துணை வினா தமிழ் அல்லது null",
          "text_te": "ఉప-ప్రశ్న తెలుగు లేదా null",
          "text_kn": "ಉಪ-ಪ್ರಶ್ನೆ ಕನ್ನಡ ಅಥವಾ null",
          "tables": []
        }
      ]
    }
  ]
}
"""


async def organize_questions_with_gemini(
    raw_ocr_text: str,
    api_key: Optional[str] = None,
    model_name: str = "gemini-1.5-flash-8b"
) -> AIOrganizeResponse:
    """Send OCR text to Gemini API to structure questions, repair broken Tamil, Telugu, Kannada, Hindi, and parse subheadings and tables."""
    effective_key = (api_key and api_key.strip()) or os.getenv("GEMINI_API_KEY", "").strip()
    if not effective_key:
        raise ValueError(
            "Gemini API key is required. Please set the GEMINI_API_KEY environment variable "
            "or enter your API key in the UI."
        )

    # First pass: normalize any stray Indic digits (Devanagari, Tamil, Telugu, Kannada)
    normalized_input = normalize_indic_numerals(raw_ocr_text)

    # Initialize Google GenAI client
    client = genai.Client(api_key=effective_key)

    prompt = f"""Organize, repair broken words, extract subheadings, and structure all questions, subquestions, and tables from the following OCR exam text:

--- BEGIN OCR TEXT ---
{normalized_input}
--- END OCR TEXT ---
"""

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=AI_SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                temperature=0.1,
            )
        )
    except Exception as e:
        # Fallback to gemini-1.5-flash if model name is unrecognized
        if model_name != "gemini-1.5-flash" and "not found" in str(e).lower():
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=AI_SYSTEM_INSTRUCTION,
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )
        else:
            raise RuntimeError(f"Gemini API error: {str(e)}")

    response_text = response.text or "{}"
    def parse_gemini_json(raw: str) -> Any:
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())
        try:
            return json.loads(cleaned)
        except Exception:
            try:
                fixed = re.sub(r'\\(?![/"\\bfnrtu])', r'\\\\', cleaned)
                return json.loads(fixed)
            except Exception:
                return json.loads(cleaned, strict=False)

    try:
        data = parse_gemini_json(response_text)
    except Exception as e:
        print(f"[organize_questions_with_gemini] JSON parse error: {e}")
        data = {}

    if isinstance(data, list):
        data = {"questions": data}
    elif not isinstance(data, dict):
        data = {"questions": []}

    questions_list: List[OrganizedQuestion] = []
    raw_questions = data.get("questions", [])
    if isinstance(raw_questions, dict):
        raw_questions = list(raw_questions.values())
    elif not isinstance(raw_questions, list):
        raw_questions = []

    for q_data in raw_questions:
        if not isinstance(q_data, dict):
            continue
        sub_list: List[SubQuestion] = []
        for sq in q_data.get("subquestions", []):
            sq_tables = [
                QuestionTable(
                    title=t.get("title"),
                    markdown=t.get("markdown", ""),
                    headers=t.get("headers", []),
                    rows=t.get("rows", [])
                )
                for t in sq.get("tables", [])
            ]
            sub_list.append(
                SubQuestion(
                    subquestion_number=normalize_indic_numerals(str(sq.get("subquestion_number", ""))),
                    marks=normalize_indic_numerals(sq.get("marks")) if sq.get("marks") else None,
                    subheading=sq.get("subheading"),
                    text_en=sq.get("text_en"),
                    text_hi=normalize_indic_numerals(sq.get("text_hi", "")) if sq.get("text_hi") else None,
                    text_ta=sq.get("text_ta"),
                    text_te=sq.get("text_te"),
                    text_kn=sq.get("text_kn"),
                    tables=sq_tables
                )
            )

        q_tables = [
            QuestionTable(
                title=t.get("title"),
                markdown=t.get("markdown", ""),
                headers=t.get("headers", []),
                rows=t.get("rows", [])
            )
            for t in q_data.get("tables", [])
        ]

        questions_list.append(
            OrganizedQuestion(
                question_number=normalize_indic_numerals(str(q_data.get("question_number", ""))),
                marks=normalize_indic_numerals(q_data.get("marks")) if q_data.get("marks") else None,
                section=q_data.get("section"),
                subheading=q_data.get("subheading"),
                text_en=q_data.get("text_en"),
                text_hi=normalize_indic_numerals(q_data.get("text_hi", "")) if q_data.get("text_hi") else None,
                text_ta=q_data.get("text_ta"),
                text_te=q_data.get("text_te"),
                text_kn=q_data.get("text_kn"),
                tables=q_tables,
                subquestions=sub_list
            )
        )

    return AIOrganizeResponse(
        success=True,
        exam_title=data.get("exam_title"),
        total_questions=len(questions_list),
        questions=questions_list,
        raw_ai_response=response_text
    )


SUBJECT_PROMPTS = {
    "formula_maths": """
SPECIALIZED MATHEMATICS & FORMULA GUIDELINES:
- Convert and preserve ALL mathematical equations and formulas in standard LaTeX syntax:
  * Inline math enclosed in single dollar signs: `$ ... $` (e.g. `$f(x) = \\lim_{n \\to \\infty} \\frac{a^x + \\sin(x/4) - 1}{[a + \\sin(x/4)]^n + 1}$`, `$G$`, `$O(uv) = n$`).
  * Block equations enclosed in double dollar signs: `$$ ... $$` (e.g. `$$\\int_0^{2\\pi} \\frac{\\sin^2 \\theta}{a + b\\cos\\theta} d\\theta = \\frac{2\\pi}{b^2}(a - \\sqrt{a^2 - b^2})$$`).
- Maintain exact mathematical terms: limits, integrals, matrices, fractions, partial differentials, group theory notation, vectors.
- Extract any formula strings into `latex_formulas` list on each question / subquestion.
- IMPORTANT FOR DIAGRAMS & GRAPHS:
  * If a question says "draw the graph", "sketch the graph", "plot the curve", or contains mathematical formulas that can be written in LaTeX, DO NOT attach a diagram if the formulas are transcribed.
  * Only link a cropped diagram if the question specifically references an un-transcribable visual figure, geometric drawing, or logic circuit (e.g. "Consider the logic circuit L", "चित्र में दर्शाया गया"), OR if the formula could not be transcribed into LaTeX and is only visible in the cropped image.
""",
    "physics": """
SPECIALIZED PHYSICS & DIAGRAM GUIDELINES:
- Preserve physics equations, vector signs ($\\vec{v}, \\vec{B}$), derivatives ($\\frac{d\\theta}{dt}$), kinetic energy expressions ($2T = \\dots$).
- Format standard SI units and dimensional formulas ($m/s^2$, $kg$, $rad/s$).
- Highlight any questions with circuit diagrams, mechanics diagrams (pulleys, hemispheres, pivoted rods, cylinders in fluid streams), or optical ray setups.
- Extract relevant physical formulas into `latex_formulas`.
""",
    "chemistry": """
SPECIALIZED CHEMISTRY & REACTION GUIDELINES:
- Format all chemical formulas cleanly with proper subscript/superscript: $H_2SO_4$, $KMnO_4$, $Fe^{3+}$, $CH_3COOH$.
- Format reaction equations with proper reaction arrows: $\\rightarrow$, $\\rightleftharpoons$.
- Include states of matter: $(s), (l), (g), (aq)$.
- Note any questions referencing apparatus, titration curves, or structural molecular diagrams.
""",
    "general": """
GENERAL MULTILINGUAL QUESTION PAPER GUIDELINES:
- Structure questions, subquestions, marks, and tables across English, Hindi, Tamil, Telugu, and Kannada.
"""
}


# Diagram reference keywords (excluding tables and generic words)
DIAGRAM_REFERENCE_KEYWORDS = [
    "circuit", "logic circuit", "circuits", "gate", "gates", "peripath", "परिपथ", "तर्क परिपथ",
    "diagram", "figure", "fig", "चित्र", "आरेख",
    "schematic", "apparatus", "उपकरण"
]


def contains_diagram_keyword(text: Optional[str]) -> bool:
    if not text:
        return False
    lower = text.lower()
    return any(kw in lower for kw in DIAGRAM_REFERENCE_KEYWORDS)


def get_diagram_badge_title(text: Optional[str], default_title: str = "Diagram / Figure") -> str:
    if not text:
        return default_title
    lower = text.lower()
    if any(k in lower for k in ["circuit", "peripath", "परिपथ", "gate", "तर्क परिपथ"]):
        return "Circuit Diagram"
    if any(k in lower for k in ["apparatus", "उपकरण", "schematic"]):
        return "Apparatus Diagram"
    return default_title


def has_math_formula(text: Optional[str], latex_formulas: Optional[List[str]] = None) -> bool:
    """Check if the question already has its math formulas extracted in LaTeX or inline text."""
    if latex_formulas and len(latex_formulas) > 0:
        return True
    if not text:
        return False
    # Detect inline/block LaTeX formulas
    if re.search(r"\$[^$]+\$|\$\$.+?\$\$", text, re.DOTALL):
        return True
    # Detect standard LaTeX math symbols/commands
    if re.search(r"\\(frac|sqrt|int|sum|lim|partial|alpha|beta|theta|gamma|delta|pi|pmatrix|bmatrix|times|cdot|approx|leq|geq)", text):
        return True
    return False


def find_question_page(
    question_text: str,
    page_texts: Optional[List[str]] = None,
    default_page: int = 1
) -> int:
    """Find the page number (1-indexed) where question_text appears with highest keyword match."""
    if not page_texts or not question_text:
        return default_page

    words = [w.lower() for w in re.findall(r"[\w\u0900-\u0DFF]{4,}", question_text)]
    if not words:
        return default_page

    best_page = default_page
    best_score = -1
    for p_idx, p_text in enumerate(page_texts, 1):
        p_lower = p_text.lower()
        score = sum(1 for w in words if w in p_lower)
        if score > best_score:
            best_score = score
            best_page = p_idx

    return best_page if best_score > 0 else default_page


async def organize_subject_questions(
    raw_ocr_text: str,
    subject_type: str = "formula_maths",
    diagrams: Optional[List[Any]] = None,
    api_key: Optional[str] = None,
    model_name: str = "gemini-2.5-flash",
    page_texts: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Subject-aware organizer for Mathematics (LaTeX), Physics, and Chemistry.
    Automatically links cropped diagrams with their respective questions and ensures
    diagrams/circuits/tables are placed directly below question statements and LaTeX formulas.
    """
    effective_key = (api_key and api_key.strip()) or os.getenv("GEMINI_API_KEY", "").strip()
    if not effective_key:
        raise ValueError(
            "Gemini API key is required. Please set the GEMINI_API_KEY environment variable "
            "or enter your API key in the UI."
        )

    normalized_input = normalize_indic_numerals(raw_ocr_text)
    subject_guideline = SUBJECT_PROMPTS.get(subject_type, SUBJECT_PROMPTS["formula_maths"])

    diagram_context = ""
    if diagrams:
        diagram_context = "Available detected diagrams on pages:\n" + "\n".join(
            f"- Diagram ID: {d.id}, Page: {d.page_number}, suggested question: {d.question_ref or 'unknown'}, title: {d.title}"
            for d in diagrams
        )

    system_inst = f"""{AI_SYSTEM_INSTRUCTION}

{subject_guideline}

{diagram_context}

CRITICAL DIAGRAM & PLACEMENT RULES:
1. When a question or subquestion mentions visual figures like 'circuit', 'logic circuit', 'peripath', 'परिपथ', 'gate', 'diagram', 'figure', 'चित्र':
   - Explicitly assign `diagram_ref`: "<question_or_subquestion_number>" (e.g. "5(c)", "5", "3(c)").
   - These diagrams belong directly below the question/subquestion problem statement and its LaTeX formula block, BEFORE subsequent sub-prompts like (i), (ii), (iii).
2. DO NOT treat tables as diagrams. Extract all tabular data into the `tables` array as clean Markdown tables.
3. In Mathematics: Do NOT treat "plot", "graph", or questions asking students to sketch curves as diagrams if the formula is transcribed.
4. Plain conceptual mathematical proofs (e.g. abstract algebra, definitions) without figures have NO diagrams.
"""

    prompt = f"""Organize this {subject_type} exam paper OCR into clean, structured questions with LaTeX math and diagram mapping:

--- OCR TEXT ---
{normalized_input}
--- END OCR TEXT ---
"""

    client = genai.Client(api_key=effective_key)
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_inst,
                response_mime_type="application/json",
                temperature=0.1,
            )
        )
    except Exception as e:
        if model_name != "gemini-1.5-flash" and "not found" in str(e).lower():
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_inst,
                    response_mime_type="application/json",
                    temperature=0.1,
                )
            )
        else:
            raise RuntimeError(f"Gemini API error: {str(e)}")

    response_text = response.text or "{}"
    def parse_gemini_json(raw: str) -> Any:
        # Strip markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())
        try:
            return json.loads(cleaned)
        except Exception:
            # Handle invalid LaTeX backslashes like \int, \frac, \sin that cause json decode error
            try:
                # Replace invalid escapes with double backslashes
                fixed = re.sub(r'\\(?![/"\\bfnrtu])', r'\\\\', cleaned)
                return json.loads(fixed)
            except Exception:
                return json.loads(cleaned, strict=False)

    try:
        data = parse_gemini_json(response_text)
    except Exception as e:
        print(f"[organize_subject_questions] JSON parse error: {e}, snippet: {response_text[:300]}")
        data = {}

    # If Gemini returned a list of questions directly: [ { ... }, { ... } ]
    if isinstance(data, list):
        data = {"questions": data}
    elif not isinstance(data, dict):
        data = {"questions": []}

    # Diagram lookup map by question reference (e.g. "5(c)", "5", "Q5(c)")
    diag_map: Dict[str, List[Any]] = {}
    unassigned_diagrams: List[Any] = list(diagrams) if diagrams else []

    if diagrams:
        for d in diagrams:
            ref = (d.question_ref or "").lower().replace("q", "").replace(".", "").strip()
            if ref:
                diag_map.setdefault(ref, []).append(d)

    questions_list: List[OrganizedQuestion] = []
    raw_questions = data.get("questions", [])
    if isinstance(raw_questions, dict):
        raw_questions = list(raw_questions.values())
    elif not isinstance(raw_questions, list):
        raw_questions = []

    for q_data in raw_questions:
        if not isinstance(q_data, dict):
            continue
        q_num = normalize_indic_numerals(str(q_data.get("question_number", ""))).strip()
        q_norm_key = q_num.lower().replace("q", "").replace(".", "").strip()
        combined_q_text = f"{q_data.get('text_en', '')} {q_data.get('text_hi', '')} {q_data.get('subheading', '')}"
        q_page = find_question_page(combined_q_text, page_texts, default_page=1)

        sub_list: List[SubQuestion] = []
        for sq in q_data.get("subquestions", []):
            sq_num = normalize_indic_numerals(str(sq.get("subquestion_number", ""))).strip()
            sq_norm_key = sq_num.lower().replace("q", "").replace(".", "").strip()

            combined_sub_text = f"{sq.get('text_en', '')} {sq.get('text_hi', '')} {sq.get('subheading', '')}"
            sq_page = find_question_page(combined_sub_text, page_texts, default_page=q_page)
            sq_has_diagram_kw = contains_diagram_keyword(combined_sub_text)
            sq_latex = sq.get("latex_formulas", [])

            # Find matching diagrams for this subquestion
            matching_diags = []
            if diagrams:
                # 1. Exact ref match
                for k, diags in list(diag_map.items()):
                    if k in [sq_norm_key, f"{q_norm_key}({sq_norm_key})", f"{q_norm_key}{sq_norm_key}"]:
                        for d in diags:
                            if d in unassigned_diagrams:
                                matching_diags.append(d)
                                unassigned_diagrams.remove(d)

                # 2. Match ONLY on the SAME PAGE if subquestion explicitly mentions visual diagram/circuit
                if not matching_diags and sq_has_diagram_kw and unassigned_diagrams:
                    page_candidates = [d for d in unassigned_diagrams if d.page_number == sq_page]
                    if page_candidates:
                        is_circuit_ref = any(k in combined_sub_text.lower() for k in ["circuit", "peripath", "परिपथ", "gate", "तर्क परिपथ"])
                        # If circuit reference, prioritize diagram titled Circuit or with largest dimensions
                        if is_circuit_ref:
                            page_candidates.sort(key=lambda d: ("circuit" in (d.title or "").lower(), (d.width or 0) * (d.height or 0)), reverse=True)

                        badge_title = "Circuit Diagram" if is_circuit_ref else get_diagram_badge_title(combined_sub_text)
                        # Attach all candidate diagrams on this page (supports continuation diagrams)
                        for d_idx, d in enumerate(list(page_candidates)):
                            d.question_ref = f"Q{q_num}({sq_num})"
                            if len(page_candidates) == 1:
                                d.title = badge_title
                            else:
                                d.title = f"{badge_title} (Part {d_idx + 1})" if is_circuit_ref else f"{badge_title} - Figure {d_idx + 1}"
                            matching_diags.append(d)
                            if d in unassigned_diagrams:
                                unassigned_diagrams.remove(d)

            sq_tables = [
                QuestionTable(
                    title=t.get("title"),
                    markdown=t.get("markdown", ""),
                    headers=t.get("headers", []),
                    rows=t.get("rows", [])
                )
                for t in sq.get("tables", [])
            ]

            sub_list.append(
                SubQuestion(
                    subquestion_number=sq_num,
                    marks=normalize_indic_numerals(sq.get("marks")) if sq.get("marks") else None,
                    subheading=sq.get("subheading"),
                    text_en=sq.get("text_en"),
                    text_hi=normalize_indic_numerals(sq.get("text_hi", "")) if sq.get("text_hi") else None,
                    text_ta=sq.get("text_ta"),
                    text_te=sq.get("text_te"),
                    text_kn=sq.get("text_kn"),
                    latex_formulas=sq_latex,
                    diagrams=matching_diags,
                    tables=sq_tables
                )
            )

        # Question level matching diagrams
        q_has_diagram_kw = contains_diagram_keyword(combined_q_text)
        q_latex = q_data.get("latex_formulas", [])

        q_matching_diags = []
        if diagrams and q_norm_key in diag_map:
            for d in diag_map[q_norm_key]:
                if d in unassigned_diagrams:
                    q_matching_diags.append(d)
                    unassigned_diagrams.remove(d)

        # Match ONLY on the SAME PAGE if question explicitly mentions a visual diagram/circuit keyword
        if not q_matching_diags and q_has_diagram_kw and unassigned_diagrams:
            q_page_candidates = [d for d in unassigned_diagrams if d.page_number == q_page]
            if q_page_candidates:
                is_circuit_ref = any(k in combined_q_text.lower() for k in ["circuit", "peripath", "परिपथ", "gate", "तर्क परिपथ"])
                if is_circuit_ref:
                    q_page_candidates.sort(key=lambda d: ("circuit" in (d.title or "").lower(), (d.width or 0) * (d.height or 0)), reverse=True)

                badge_title = "Circuit Diagram" if is_circuit_ref else get_diagram_badge_title(combined_q_text)
                for d_idx, d in enumerate(list(q_page_candidates)):
                    d.question_ref = f"Q{q_num}"
                    if len(q_page_candidates) == 1:
                        d.title = badge_title
                    else:
                        d.title = f"{badge_title} (Part {d_idx + 1})" if is_circuit_ref else f"{badge_title} - Figure {d_idx + 1}"
                    q_matching_diags.append(d)
                    if d in unassigned_diagrams:
                        unassigned_diagrams.remove(d)

        q_tables = [
            QuestionTable(
                title=t.get("title"),
                markdown=t.get("markdown", ""),
                headers=t.get("headers", []),
                rows=t.get("rows", [])
            )
            for t in q_data.get("tables", [])
        ]

        questions_list.append(
            OrganizedQuestion(
                question_number=q_num,
                marks=normalize_indic_numerals(q_data.get("marks")) if q_data.get("marks") else None,
                section=q_data.get("section"),
                subheading=q_data.get("subheading"),
                text_en=q_data.get("text_en"),
                text_hi=normalize_indic_numerals(q_data.get("text_hi", "")) if q_data.get("text_hi") else None,
                text_ta=q_data.get("text_ta"),
                text_te=q_data.get("text_te"),
                text_kn=q_data.get("text_kn"),
                latex_formulas=q_latex,
                diagrams=q_matching_diags,
                tables=q_tables,
                subquestions=sub_list
            )
        )

    # Note: Unassigned diagrams are NOT dumped onto questions_list[0]
    # They remain visible in the "Cropped Diagrams Gallery" tab (#tab-diagrams)

    return {
        "exam_title": data.get("exam_title"),
        "questions": questions_list,
        "raw_response": response_text
    }