export const MAINS_PAPER_OPTIONS = [
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
] as const;

export type MainsPaperOption = (typeof MAINS_PAPER_OPTIONS)[number];

export interface DiagramItem {
  id: string;
  title?: string;
  question_ref?: string | null;
  page_number: number;
  image_url: string;
  data_url?: string;
  width: number;
  height: number;
  bounding_box?: number[];
  manually_assigned?: boolean;
}

export interface QuestionTable {
  title?: string | null;
  markdown: string;
  headers?: string[];
  rows?: string[][];
}

export interface SubQuestion {
  subquestion_number: string;
  marks?: string | null;
  subheading?: string | null;
  text_en?: string | null;
  text_hi?: string | null;
  text_ta?: string | null;
  text_te?: string | null;
  text_kn?: string | null;
  latex_formulas?: string[];
  diagrams?: DiagramItem[];
  tables?: QuestionTable[];
}

export interface MainsQuestionPaper {
  id: string;
  paperid?: string;
  paper_name: string;
  papername?: string;
  paper_year?: number | null;
  paperyear?: number | null;
  time_limit: string;
  timelimit?: string;
  time_limit_minutes: number;
  subject_type?: string;
  total_marks?: number | null;
  source_filename?: string | null;
  questions_count?: number;
  created_at?: string;
}

export interface OcrQuestion {
  id?: string;
  paper_id?: string | null;
  paperid?: string | null;
  paper_name?: string | null;
  papername?: string | null;
  paper_year?: number | null;
  paperyear?: number | null;
  time_limit?: string | null;
  timelimit?: string | null;
  time_limit_minutes?: number | null;
  status?: "SAVED" | "APPROVED" | string;
  subject_type?: string;
  question_number?: string;
  section?: string | null;
  subheading?: string | null;
  text_en: string;
  text_hi?: string | null;
  text_ta?: string | null;
  text_te?: string | null;
  text_kn?: string | null;
  latex_formulas?: string[];
  diagrams?: DiagramItem[];
  tables?: QuestionTable[];
  subquestions?: SubQuestion[];
  marks?: string | null;
  model_answer?: string | null;
  source_filename?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OcrProcessResult {
  success: boolean;
  subject_type: string;
  exam_title?: string;
  engine_used: string;
  total_questions: number;
  total_diagrams: number;
  questions: OcrQuestion[];
  diagrams: DiagramItem[];
  raw_text?: string;
  processing_time_sec: number;
  paper_name?: string;
  paper_year?: number;
  time_limit?: string;
}
