from typing import List, Optional
from pydantic import BaseModel, Field

class PageOCRResult(BaseModel):
    page_number: int = Field(..., description="1-indexed page number")
    text: str = Field(..., description="Extracted OCR text for this page")
    char_count: int = Field(..., description="Character count for this page")
    word_count: int = Field(..., description="Word count for this page")

class PDFOCRResponse(BaseModel):
    success: bool = True
    filename: str = Field(..., description="Uploaded PDF filename")
    total_pages: int = Field(..., description="Number of pages processed")
    languages: str = Field(..., description="Tesseract OCR language(s) used")
    dpi: int = Field(..., description="Resolution in DPI used for PDF rendering")
    processing_time_sec: float = Field(..., description="Processing time in seconds")
    combined_text: str = Field(..., description="Combined text from all pages")
    pages: List[PageOCRResult] = Field(..., description="List of per-page OCR results")

class ImageOCRResponse(BaseModel):
    success: bool = True
    filename: str = Field(..., description="Uploaded image filename")
    languages: str = Field(..., description="Tesseract OCR language(s) used")
    processing_time_sec: float = Field(..., description="Processing time in seconds")
    text: str = Field(..., description="Extracted OCR text")
    char_count: int = Field(..., description="Character count")
    word_count: int = Field(..., description="Word count")

class LanguagesResponse(BaseModel):
    available_languages: List[str]
    default_languages: str

class HealthResponse(BaseModel):
    status: str
    tesseract_version: str
    pdftoppm_version: str
    available_languages: List[str]

class DiagramItem(BaseModel):
    id: str = Field(..., description="Unique ID of cropped diagram")
    question_ref: Optional[str] = Field(None, description="Associated question reference (e.g. 'Q5(c)', 'Q2')")
    title: Optional[str] = Field("Diagram / Circuit", description="Caption or description of the diagram")
    page_number: int = Field(1, description="Source page number")
    image_url: str = Field(..., description="Web accessible URL to cropped diagram")
    data_url: Optional[str] = Field(None, description="Base64 data URI of the diagram for direct embedding")
    width: int = Field(..., description="Width in pixels")
    height: int = Field(..., description="Height in pixels")
    bounding_box: Optional[List[int]] = Field(None, description="[ymin, xmin, ymax, xmax] coordinates")

class QuestionTable(BaseModel):
    title: Optional[str] = None
    markdown: str = Field(..., description="Markdown representation of table")
    headers: List[str] = Field(default_factory=list)
    rows: List[List[str]] = Field(default_factory=list)

class SubQuestion(BaseModel):
    subquestion_number: str = Field(..., description="E.g. 1(a), 1(b), (i), (ii)")
    marks: Optional[str] = None
    subheading: Optional[str] = Field(None, description="Subheading or topic for this subquestion")
    text_en: Optional[str] = Field(None, description="English text")
    text_hi: Optional[str] = Field(None, description="Repaired Hindi text")
    text_ta: Optional[str] = Field(None, description="Repaired Tamil text (reconnected broken words/pulli)")
    text_te: Optional[str] = Field(None, description="Repaired Telugu text (reconnected broken words/guninthalu/vattulu)")
    text_kn: Optional[str] = Field(None, description="Repaired Kannada text (reconnected broken words/ottakshara)")
    latex_formulas: List[str] = Field(default_factory=list, description="LaTeX equations detected in this subquestion")
    diagrams: List[DiagramItem] = Field(default_factory=list, description="Cropped diagrams belonging to this subquestion")
    tables: List[QuestionTable] = Field(default_factory=list)

class OrganizedQuestion(BaseModel):
    question_number: str = Field(..., description="Standardized question number (e.g. 1, 2)")
    marks: Optional[str] = None
    section: Optional[str] = Field(None, description="Section or Part header (e.g. 'Section A', 'खण्ड A')")
    subheading: Optional[str] = Field(None, description="Subheading or topic instruction")
    text_en: Optional[str] = Field(None, description="English text")
    text_hi: Optional[str] = Field(None, description="Repaired Hindi text")
    text_ta: Optional[str] = Field(None, description="Repaired Tamil text")
    text_te: Optional[str] = Field(None, description="Repaired Telugu text")
    text_kn: Optional[str] = Field(None, description="Repaired Kannada text")
    latex_formulas: List[str] = Field(default_factory=list, description="LaTeX equations detected in this question")
    diagrams: List[DiagramItem] = Field(default_factory=list, description="Cropped diagrams belonging to this question")
    tables: List[QuestionTable] = Field(default_factory=list)
    subquestions: List[SubQuestion] = Field(default_factory=list)

class AIOrganizeResponse(BaseModel):
    success: bool = True
    exam_title: Optional[str] = None
    total_questions: int
    questions: List[OrganizedQuestion]
    raw_ai_response: Optional[str] = None

class AIOrganizeRequest(BaseModel):
    text: str = Field(..., description="Raw or combined OCR text to organize")
    api_key: Optional[str] = Field(None, description="Optional Gemini API key override")
    model: Optional[str] = Field("gemini-1.5-flash-8b", description="Gemini model name")
    subject_type: Optional[str] = Field("formula_maths", description="'formula_maths', 'physics', 'chemistry', or 'general'")

class SubjectProcessResponse(BaseModel):
    success: bool = True
    subject_type: str = Field(..., description="'formula_maths', 'physics', 'chemistry', or 'general'")
    exam_title: Optional[str] = None
    engine_used: str = Field(..., description="OCR / parsing engine used")
    total_questions: int
    total_diagrams: int
    questions: List[OrganizedQuestion]
    diagrams: List[DiagramItem]
    raw_text: Optional[str] = None
    processing_time_sec: float
    paper_name: Optional[str] = None
    paper_year: Optional[int] = None
    time_limit: Optional[str] = "3 hours"


class MainsQuestionPaperCreate(BaseModel):
    paper_name: Optional[str] = None
    papername: Optional[str] = None
    paper_year: Optional[int] = None
    paperyear: Optional[int] = None
    time_limit: Optional[str] = "3 hours"
    timelimit: Optional[str] = "3 hours"
    time_limit_minutes: Optional[int] = 180
    subject_type: Optional[str] = "formula_maths"
    total_marks: Optional[int] = None
    source_filename: Optional[str] = None


class MainsQuestionPaperResponse(BaseModel):
    id: str
    paperid: Optional[str] = None
    paper_name: str
    papername: Optional[str] = None
    paper_year: Optional[int] = None
    paperyear: Optional[int] = None
    time_limit: str = "3 hours"
    timelimit: Optional[str] = "3 hours"
    time_limit_minutes: int = 180
    subject_type: Optional[str] = "formula_maths"
    total_marks: Optional[int] = None
    source_filename: Optional[str] = None
    questions_count: Optional[int] = 0
    created_at: Optional[str] = None


class OcrMainsQuestionPayload(BaseModel):
    id: Optional[str] = None
    paper_id: Optional[str] = None
    paperid: Optional[str] = None
    paper_name: Optional[str] = None
    papername: Optional[str] = None
    paper_year: Optional[int] = None
    paperyear: Optional[int] = None
    time_limit: Optional[str] = None
    timelimit: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    status: Optional[str] = "SAVED"
    subject_type: Optional[str] = "formula_maths"
    question_number: Optional[str] = None
    section: Optional[str] = None
    subheading: Optional[str] = None
    text_en: Optional[str] = ""
    text_hi: Optional[str] = None
    text_ta: Optional[str] = None
    text_te: Optional[str] = None
    text_kn: Optional[str] = None
    latex_formulas: List[str] = Field(default_factory=list)
    subquestions: List[dict] = Field(default_factory=list)
    diagrams: List[dict] = Field(default_factory=list)
    tables: List[dict] = Field(default_factory=list)
    marks: Optional[str] = None
    model_answer: Optional[str] = None
    source_filename: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        extra = "allow"


MAINS_PAPER_NAMES: List[str] = [
    "Essay",
    "General Studies I (GS-I)",
    "General Studies II (GS-II)",
    "General Studies III (GS-III)",
    "General Studies IV (GS-IV)",
    "Optional – Economics",
    "Optional – Political Science & International Relations (PSIR)",
    "Optional – Sociology",
    "Optional – Public Administration",
    "Optional – Geography",
    "Optional – History",
    "Optional – Anthropology",
    "Optional – Philosophy",
    "Optional – Law",
    "Optional – Commerce & Accountancy",
    "Optional – Psychology",
    "Optional – Agriculture",
    "Optional – Mathematics",
    "Optional – Management",
    "Optional – Hindi Literature",
    "Optional – Zoology",
]


class OcrMainsSaveBatchRequest(BaseModel):
    questions: List[OcrMainsQuestionPayload]
    paper_name: Optional[str] = Field(
        default=None,
        description="One of the 21 UPSC Mains papers, e.g. 'General Studies I (GS-I)', 'Essay', or optional subjects",
    )
    paper_year: Optional[int] = None
    time_limit: Optional[str] = "3 hours"
    paper_id: Optional[str] = None
    source_filename: Optional[str] = None
    subject_type: Optional[str] = "formula_maths"

    class Config:
        extra = "allow"


class OcrMainsStatusUpdateRequest(BaseModel):
    status: str = Field(..., description="'SAVED' or 'APPROVED'")


class OcrMainsBatchApproveRequest(BaseModel):
    ids: List[str]

