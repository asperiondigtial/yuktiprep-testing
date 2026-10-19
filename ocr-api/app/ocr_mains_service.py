import json
import uuid
from typing import List, Optional, Dict, Any
from app.db import get_db_connection
from psycopg2.extras import RealDictCursor, Json


def create_or_get_mains_question_paper(
    paper_name: str,
    paper_year: Optional[int] = None,
    time_limit: str = "3 hours",
    subject_type: str = "formula_maths",
    total_marks: Optional[int] = None,
    source_filename: Optional[str] = None
) -> Dict[str, Any]:
    """Finds an existing paper by name and year, or creates a new one."""
    select_sql = """
    SELECT * FROM mains_question_papers
    WHERE paper_name = %s AND (paper_year = %s OR (paper_year IS NULL AND %s IS NULL))
    LIMIT 1;
    """
    insert_sql = """
    INSERT INTO mains_question_papers (
        id, paper_name, paper_year, time_limit, time_limit_minutes,
        subject_type, total_marks, source_filename, created_at, updated_at
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s, NOW(), NOW()
    )
    RETURNING *;
    """
    # Parse minutes from time_limit if given like "3 hours" or "180 mins"
    time_limit_mins = 180
    if time_limit and ("hr" in time_limit.lower() or "hour" in time_limit.lower()):
        try:
            num = int(''.join(filter(str.isdigit, time_limit)))
            time_limit_mins = num * 60
        except Exception:
            time_limit_mins = 180
    elif time_limit:
        try:
            time_limit_mins = int(''.join(filter(str.isdigit, time_limit)))
        except Exception:
            time_limit_mins = 180

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(select_sql, (paper_name, paper_year, paper_year))
            existing = cur.fetchone()
            if existing:
                res = dict(existing)
                res["id"] = str(res["id"])
                res["paperid"] = str(res.get("paperid") or res["id"])
                return res

            paper_id = str(uuid.uuid4())
            cur.execute(
                insert_sql,
                (
                    paper_id, paper_name, paper_year, time_limit or "3 hours",
                    time_limit_mins, subject_type, total_marks, source_filename
                )
            )
            row = cur.fetchone()
            conn.commit()
            res = dict(row)
            res["id"] = str(res["id"])
            res["paperid"] = str(res.get("paperid") or res["id"])
            return res


def get_mains_question_papers() -> List[Dict[str, Any]]:
    """Returns all question papers with saved and approved questions count."""
    sql = """
    SELECT p.*,
           COUNT(q.id) as questions_count,
           COUNT(CASE WHEN q.status = 'SAVED' THEN 1 END) as saved_count,
           COUNT(CASE WHEN q.status = 'APPROVED' THEN 1 END) as approved_count
    FROM mains_question_papers p
    LEFT JOIN ocr_mains_questions q ON p.id = q.paper_id
    GROUP BY p.id
    ORDER BY p.created_at DESC;
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            papers = []
            for r in rows:
                p = dict(r)
                p["id"] = str(p["id"])
                p["created_at"] = str(p["created_at"]) if p.get("created_at") else None
                papers.append(p)
            return papers


def get_mains_question_paper_by_id(paper_id: str) -> Optional[Dict[str, Any]]:
    """Returns a single question paper by ID with counts."""
    sql = """
    SELECT p.*,
           COUNT(q.id) as questions_count,
           COUNT(CASE WHEN q.status = 'SAVED' THEN 1 END) as saved_count,
           COUNT(CASE WHEN q.status = 'APPROVED' THEN 1 END) as approved_count
    FROM mains_question_papers p
    LEFT JOIN ocr_mains_questions q ON p.id = q.paper_id
    WHERE p.id = %s
    GROUP BY p.id
    LIMIT 1;
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (paper_id,))
            row = cur.fetchone()
            if not row:
                return None
            p = dict(row)
            p["id"] = str(p["id"])
            p["created_at"] = str(p["created_at"]) if p.get("created_at") else None
            return p


def save_ocr_mains_questions(
    questions: List[Dict[str, Any]],
    source_filename: Optional[str] = None,
    default_subject_type: str = "formula_maths",
    paper_id: Optional[str] = None,
    paper_name: Optional[str] = None,
    paper_year: Optional[int] = None,
    time_limit: Optional[str] = "3 hours"
) -> List[Dict[str, Any]]:
    """Inserts a batch of extracted/edited questions into ocr_mains_questions table."""
    # If paper_name is provided and no paper_id, auto-create/fetch paper
    effective_paper_id = paper_id
    if not effective_paper_id and paper_name:
        paper_obj = create_or_get_mains_question_paper(
            paper_name=paper_name,
            paper_year=paper_year,
            time_limit=time_limit or "3 hours",
            subject_type=default_subject_type,
            source_filename=source_filename
        )
        effective_paper_id = paper_obj["id"]

    inserted = []
    insert_sql = """
    INSERT INTO ocr_mains_questions (
        id, paper_id, status, subject_type, question_number, section, subheading,
        text_en, text_hi, text_ta, text_te, text_kn,
        latex_formulas, subquestions, diagrams, tables,
        marks, model_answer, source_filename, created_at, updated_at
    ) VALUES (
        %s, %s, %s, %s, %s, %s, %s,
        %s, %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s, NOW(), NOW()
    )
    RETURNING *;
    """

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for q in questions:
                q_id = q.get("id") or str(uuid.uuid4())
                q_paper_id = q.get("paper_id") or effective_paper_id
                status = q.get("status") or "SAVED"
                subj = q.get("subject_type") or default_subject_type
                q_num = q.get("question_number") or ""
                section = q.get("section") or ""
                subheading = q.get("subheading") or ""
                text_en = q.get("text_en") or ""
                text_hi = q.get("text_hi")
                text_ta = q.get("text_ta")
                text_te = q.get("text_te")
                text_kn = q.get("text_kn")
                latex_formulas = Json(q.get("latex_formulas") or [])
                subquestions = Json(q.get("subquestions") or [])
                diagrams = Json(q.get("diagrams") or [])
                tables = Json(q.get("tables") or [])
                marks = str(q.get("marks")) if q.get("marks") is not None else None
                model_answer = q.get("model_answer")
                src_file = q.get("source_filename") or source_filename

                cur.execute(
                    insert_sql,
                    (
                        q_id, q_paper_id, status, subj, q_num, section, subheading,
                        text_en, text_hi, text_ta, text_te, text_kn,
                        latex_formulas, subquestions, diagrams, tables,
                        marks, model_answer, src_file
                    )
                )
                row = cur.fetchone()
                if row:
                    row["id"] = str(row["id"])
                    if row.get("paper_id"):
                        row["paper_id"] = str(row["paper_id"])
                    inserted.append(dict(row))
        conn.commit()

    return inserted


def get_ocr_mains_questions(
    status: Optional[str] = None,
    subject_type: Optional[str] = None,
    paper_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Dict[str, Any]:
    """Queries questions with joined paper metadata, status filter, and optional search."""
    where_clauses = []
    params = []

    if status:
        where_clauses.append("q.status = %s")
        params.append(status.upper())

    if subject_type:
        where_clauses.append("q.subject_type = %s")
        params.append(subject_type)

    if paper_id:
        where_clauses.append("q.paper_id = %s")
        params.append(paper_id)

    if search and search.strip():
        where_clauses.append("(q.text_en ILIKE %s OR q.question_number ILIKE %s OR q.section ILIKE %s OR p.paper_name ILIKE %s)")
        term = f"%{search.strip()}%"
        params.extend([term, term, term, term])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    count_sql = f"""
    SELECT COUNT(*) FROM ocr_mains_questions q
    LEFT JOIN mains_question_papers p ON q.paper_id = p.id
    {where_sql};
    """
    query_sql = f"""
    SELECT q.*,
           p.paper_name,
           p.paper_year,
           p.time_limit,
           p.time_limit_minutes,
           p.papername,
           p.paperyear,
           p.timelimit,
           p.id as paperid
    FROM ocr_mains_questions q
    LEFT JOIN mains_question_papers p ON q.paper_id = p.id
    {where_sql}
    ORDER BY 
        NULLIF(regexp_replace(q.question_number, '\\D', '', 'g'), '')::int ASC NULLS LAST,
        q.question_number ASC,
        q.created_at ASC
    LIMIT %s OFFSET %s;
    """

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(count_sql, tuple(params))
            total = cur.fetchone()["count"]

            query_params = list(params) + [limit, offset]
            cur.execute(query_sql, tuple(query_params))
            rows = cur.fetchall()
            items = []
            for r in rows:
                item = dict(r)
                item["id"] = str(item["id"])
                if item.get("paper_id"):
                    item["paper_id"] = str(item["paper_id"])
                items.append(item)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items
    }


def get_ocr_mains_question_by_id(question_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a single question by UUID with paper details."""
    sql = """
    SELECT q.*, p.paper_name, p.paper_year, p.time_limit, p.time_limit_minutes
    FROM ocr_mains_questions q
    LEFT JOIN mains_question_papers p ON q.paper_id = p.id
    WHERE q.id = %s;
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (question_id,))
            row = cur.fetchone()
            if not row:
                return None
            item = dict(row)
            item["id"] = str(item["id"])
            if item.get("paper_id"):
                item["paper_id"] = str(item["paper_id"])
            return item


def update_ocr_mains_question(question_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Updates question fields and returns updated row."""
    allowed_fields = [
        "paper_id", "status", "subject_type", "question_number", "section", "subheading",
        "text_en", "text_hi", "text_ta", "text_te", "text_kn",
        "latex_formulas", "subquestions", "diagrams", "tables",
        "marks", "model_answer"
    ]
    set_clauses = ["updated_at = NOW()"]
    params = []

    for f in allowed_fields:
        if f in data:
            val = data[f]
            if f in ["latex_formulas", "subquestions", "diagrams", "tables"] and isinstance(val, (list, dict)):
                set_clauses.append(f"{f} = %s")
                params.append(Json(val))
            else:
                set_clauses.append(f"{f} = %s")
                params.append(str(val) if f == "marks" and val is not None else val)

    if not params:
        return get_ocr_mains_question_by_id(question_id)

    sql = f"""
    UPDATE ocr_mains_questions
    SET {', '.join(set_clauses)}
    WHERE id = %s
    RETURNING *;
    """
    params.append(question_id)

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, tuple(params))
            row = cur.fetchone()
            if not row:
                return None
            conn.commit()
            item = dict(row)
            item["id"] = str(item["id"])
            if item.get("paper_id"):
                item["paper_id"] = str(item["paper_id"])
            return item


def update_ocr_mains_status(question_id: str, new_status: str) -> Optional[Dict[str, Any]]:
    """Transitions status of a single question (e.g. SAVED -> APPROVED)."""
    sql = """
    UPDATE ocr_mains_questions
    SET status = %s, updated_at = NOW()
    WHERE id = %s
    RETURNING *;
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (new_status.upper(), question_id))
            row = cur.fetchone()
            if not row:
                return None
            conn.commit()
            item = dict(row)
            item["id"] = str(item["id"])
            return item


def batch_approve_ocr_mains(question_ids: List[str]) -> int:
    """Batch updates status to APPROVED for list of question IDs."""
    if not question_ids:
        return 0
    sql = """
    UPDATE ocr_mains_questions
    SET status = 'APPROVED', updated_at = NOW()
    WHERE id = ANY(%s::uuid[]);
    """
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (question_ids,))
            affected = cur.rowcount
            conn.commit()
            return affected


def delete_ocr_mains_question(question_id: str) -> bool:
    """Deletes a question by ID."""
    sql = "DELETE FROM ocr_mains_questions WHERE id = %s;"
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, (question_id,))
            affected = cur.rowcount
            conn.commit()
            return affected > 0


def delete_mains_question_paper(paper_id: str) -> bool:
    """Deletes a question paper and cascades to associated questions."""
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("DELETE FROM ocr_mains_questions WHERE paper_id = %s;", (paper_id,))
            cur.execute("DELETE FROM mains_question_papers WHERE id = %s;", (paper_id,))
            affected = cur.rowcount
            conn.commit()
            return affected > 0
