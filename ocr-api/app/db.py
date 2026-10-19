import os
import json
import uuid
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, Json

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "yuktiprep-db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "123456")

DATABASE_URL = os.getenv("DATABASE_URL")


def get_db_connection():
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def init_db():
    """Initializes mains_question_papers and ocr_mains_questions tables."""
    create_tables_sql = """
    -- 1. Mains Question Papers Table
    CREATE TABLE IF NOT EXISTS mains_question_papers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_name VARCHAR(255) NOT NULL,
        paper_year INT NULL,
        time_limit VARCHAR(50) NOT NULL DEFAULT '3 hours',
        time_limit_minutes INT NOT NULL DEFAULT 180,
        subject_type VARCHAR(50) DEFAULT 'formula_maths',
        total_marks INT NULL,
        source_filename VARCHAR(255) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_mains_papers_created_at ON mains_question_papers(created_at DESC);

    -- 2. OCR Mains Questions Table
    CREATE TABLE IF NOT EXISTS ocr_mains_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NULL REFERENCES mains_question_papers(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'SAVED',
        subject_type VARCHAR(50) DEFAULT 'formula_maths',
        exam_id UUID NULL,
        subject_id UUID NULL,
        question_number VARCHAR(50) NULL,
        section VARCHAR(100) NULL,
        subheading VARCHAR(255) NULL,
        text_en TEXT NOT NULL DEFAULT '',
        text_hi TEXT NULL,
        text_ta TEXT NULL,
        text_te TEXT NULL,
        text_kn TEXT NULL,
        latex_formulas JSONB DEFAULT '[]'::jsonb,
        subquestions JSONB DEFAULT '[]'::jsonb,
        diagrams JSONB DEFAULT '[]'::jsonb,
        tables JSONB DEFAULT '[]'::jsonb,
        marks VARCHAR(50) NULL,
        model_answer TEXT NULL,
        source_filename VARCHAR(255) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Ensure paper_id column exists if table was already created
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ocr_mains_questions' AND column_name = 'paper_id'
        ) THEN
            ALTER TABLE ocr_mains_questions 
            ADD COLUMN paper_id UUID NULL REFERENCES mains_question_papers(id) ON DELETE CASCADE;
        END IF;

        -- Ensure exact requested column aliases (papername, paperid, paperyear, timelimit) exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'mains_question_papers' AND column_name = 'papername'
        ) THEN
            ALTER TABLE mains_question_papers 
            ADD COLUMN papername VARCHAR(255) GENERATED ALWAYS AS (paper_name) STORED;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'mains_question_papers' AND column_name = 'paperid'
        ) THEN
            ALTER TABLE mains_question_papers 
            ADD COLUMN paperid UUID GENERATED ALWAYS AS (id) STORED;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'mains_question_papers' AND column_name = 'paperyear'
        ) THEN
            ALTER TABLE mains_question_papers 
            ADD COLUMN paperyear INT GENERATED ALWAYS AS (paper_year) STORED;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'mains_question_papers' AND column_name = 'timelimit'
        ) THEN
            ALTER TABLE mains_question_papers 
            ADD COLUMN timelimit VARCHAR(50) GENERATED ALWAYS AS (time_limit) STORED;
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_ocr_mains_status ON ocr_mains_questions(status);
    CREATE INDEX IF NOT EXISTS idx_ocr_mains_paper_id ON ocr_mains_questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_ocr_mains_created_at ON ocr_mains_questions(created_at DESC);
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(create_tables_sql)
            conn.commit()
    except Exception as e:
        print(f"[DB Init Warning] Failed to initialize tables: {e}")


# Run table initialization on startup
init_db()
