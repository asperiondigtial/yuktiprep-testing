export interface OcrMainsPaper {
  id: string;
  paperid?: string;
  paper_name: string;
  papername?: string;
  paper_year?: number | null;
  paperyear?: number | null;
  time_limit?: string;
  timelimit?: string;
  time_limit_minutes?: number;
  subject_type?: string;
  total_marks?: number | null;
  source_filename?: string | null;
  questions_count?: number;
  created_at?: string;
}

export interface OcrMainsQuestionItem {
  id: string;
  paper_id?: string;
  paper_name?: string;
  paper_year?: number;
  subject_type?: string;
  status: string;
  question_number?: string;
  section?: string;
  subheading?: string;
  text_en: string;
  text_hi?: string;
  text_ta?: string;
  text_te?: string;
  text_kn?: string;
  marks?: string;
  model_answer?: string;
  latex_formulas?: Array<{ id?: string; latex?: string; context?: string }>;
  diagrams?: Array<{
    id?: string;
    title?: string;
    name?: string;
    width?: number;
    height?: number;
    data_url?: string;
    image_url?: string;
    url?: string;
    description?: string;
  }>;
  subquestions?: Array<{
    subquestion_number?: string;
    label?: string;
    text_en?: string;
    text_hi?: string;
    text_ta?: string;
    text_te?: string;
    text_kn?: string;
    text?: string;
    marks?: string | number | null;
    subheading?: string | null;
    diagrams?: Array<any>;
    tables?: Array<any>;
    latex_formulas?: Array<any>;
  }>;
}

export interface EvaluationResult {
  question_number?: string;
  question_text?: string;
  overall_band: string;
  score_estimate_range: string;
  awarded_marks?: number;
  max_marks?: number;
  overall_360_index?: number;
  percentile_band?: string;
  executive_summary?: string;
  section_specific_critique?: string;
  hook_and_thesis_analysis?: {
    detected_hook_model: string;
    critique: string;
  };
  dialectic_synthesis_analysis?: {
    has_counter_argument: boolean;
    critique: string;
  };
  dimensional_matrix_audit?: {
    active_lenses: string[];
    missing_lenses: string[];
    advice: string;
  };
  evidence_and_thinker_grounding?: {
    detected_thinkers: string[];
    suggested_enrichments: Array<{
      thinker: string;
      quote_or_concept: string;
      context: string;
    }>;
  };
  paragraph_breakdown?: Array<{
    paragraph_number: number;
    role: string;
    critique: string;
  }>;
  examiner_recommendations?: string[];
  risk_analysis?: {
    risk_level: string;
    badge_color: string;
    failure_probability_pct: number;
    vulnerabilities: Array<{
      type: string;
      impact: string;
      description: string;
      how_examiner_views_it: string;
    }>;
  };
  sectional_scores?: {
    introduction: string;
    body_structure: string;
    substantiation: string;
    conclusion: string;
  };
  sme_feedback?: {
    board_lead_examiner: {
      title?: string;
      verdict?: string;
      examiner_psychology_tip: string;
    };
    domain_specialist?: {
      title?: string;
      technical_critique?: string;
      recommended_precedents: string[];
    };
    revision_mentor?: {
      title?: string;
      score_leap_strategy?: string;
      practical_drill: string;
    };
  };
  root_cause_analysis?: {
    primary_failure_mode: string;
    missed_authoritative_anchors: string[];
    missed_key_dimensions: string[];
    cognitive_blindspots: string[];
  };
  remedial_blueprint?: {
    phase_1_immediate_fix: string;
    phase_2_body_overhaul: string;
    phase_3_evidence_injection: string;
    phase_4_conclusion_upgrade: string;
    sentence_transformation_demo: {
      before_candidate_draft: string;
      after_topper_rewrite: string;
      why_it_scores_more: string;
    };
    topper_gold_booster_lines: string[];
  };
  value_add_diagram?: {
    title: string;
    benefit: string;
    suggested_diagram: string;
  };
  pillars_360?: {
    directive_precision: number;
    substantive_authority: number;
    multidimensional_pestle: number;
    examiner_impression_index: number;
    visual_scannability: number;
    visionary_synthesis: number;
  };
  paragraph_annotations?: Array<{
    section: string;
    status: string;
    severity: string;
    comment: string;
  }>;
  delta_analysis?: {
    overall_verdict: string;
    mark_jump: string;
    mark_jump_pct: string;
    risk_reduction_pct: string;
    percentile_shift: string;
    newly_added_citations?: string[];
  };
}
