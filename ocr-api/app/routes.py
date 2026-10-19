import base64
import io
import os
import time
import tempfile
import uuid
from pathlib import Path
from typing import Optional, List
from PIL import Image

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse

from app.config import DEFAULT_DPI, DEFAULT_LANGUAGES, MAX_FILE_SIZE_MB
from app.ocr_service import (
    OCRError,
    get_available_languages,
    get_versions,
    process_image,
    process_pdf,
    run_pdftoppm,
    run_tesseract_on_file,
    _extract_page_number
)
from app.ai_service import organize_questions_with_gemini, organize_subject_questions
from app.diagram_service import detect_diagram_regions_heuristic, save_cropped_diagram, is_table_crop
from app.pix2text_service import is_pix2text_available, recognize_math_with_pix2text
from app.schemas import (
    AIOrganizeRequest,
    AIOrganizeResponse,
    HealthResponse,
    ImageOCRResponse,
    LanguagesResponse,
    PDFOCRResponse,
    SubjectProcessResponse,
    DiagramItem,
    OrganizedQuestion,
    OcrMainsQuestionPayload,
    OcrMainsSaveBatchRequest,
    OcrMainsStatusUpdateRequest,
    OcrMainsBatchApproveRequest,
    MainsQuestionPaperCreate,
    MainsQuestionPaperResponse
)
from app.ocr_mains_service import (
    save_ocr_mains_questions,
    get_ocr_mains_questions,
    get_ocr_mains_question_by_id,
    update_ocr_mains_question,
    update_ocr_mains_status,
    batch_approve_ocr_mains,
    delete_ocr_mains_question,
    delete_mains_question_paper,
    create_or_get_mains_question_paper,
    get_mains_question_papers,
    get_mains_question_paper_by_id,
)
from app.diagram_service import DIAGRAMS_DIR

router = APIRouter(prefix="/api", tags=["OCR"])



async def _read_and_validate_file(file: UploadFile) -> bytes:
    """Read uploaded file and validate size."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE_MB}MB."
        )

    return content


@router.post(
    "/ocr/pdf",
    response_model=PDFOCRResponse,
    summary="OCR a PDF document",
    description="Converts PDF pages to PNG (300 DPI by default) using pdftoppm, then extracts text from each page using Tesseract (eng+hin by default)."
)
async def ocr_pdf_endpoint(
    file: UploadFile = File(..., description="PDF file to OCR"),
    languages: str = Form(DEFAULT_LANGUAGES, description="Tesseract language string (e.g. 'eng+hin', 'eng', 'hin')"),
    dpi: int = Form(DEFAULT_DPI, ge=72, le=600, description="DPI resolution for rendering pages (default: 300)"),
    start_page: Optional[int] = Form(None, ge=1, description="First page to process (optional)"),
    end_page: Optional[int] = Form(None, ge=1, description="Last page to process (optional)"),
    page_delimiter: str = Form("\n\n", description="Separator between pages in combined_text")
):
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF document."
        )

    content = await _read_and_validate_file(file)

    try:
        result = await process_pdf(
            pdf_bytes=content,
            filename=file.filename,
            languages=languages,
            dpi=dpi,
            start_page=start_page,
            end_page=end_page,
            page_delimiter=page_delimiter
        )
        return result
    except OCRError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected server error during PDF OCR: {str(e)}"
        )


@router.post(
    "/ocr/pdf/text",
    response_class=PlainTextResponse,
    summary="OCR a PDF document and return raw plain text",
    description="Matches the shell behavior 'cat page-*.txt > file.txt', returning plain text file response directly."
)
async def ocr_pdf_text_endpoint(
    file: UploadFile = File(..., description="PDF file to OCR"),
    languages: str = Form(DEFAULT_LANGUAGES, description="Tesseract language string (e.g. 'eng+hin')"),
    dpi: int = Form(DEFAULT_DPI, ge=72, le=600, description="DPI resolution (default: 300)"),
    start_page: Optional[int] = Form(None, ge=1, description="First page to process (optional)"),
    end_page: Optional[int] = Form(None, ge=1, description="Last page to process (optional)"),
    page_delimiter: str = Form("\n\n", description="Separator between pages")
):
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF document."
        )

    content = await _read_and_validate_file(file)

    try:
        result = await process_pdf(
            pdf_bytes=content,
            filename=file.filename,
            languages=languages,
            dpi=dpi,
            start_page=start_page,
            end_page=end_page,
            page_delimiter=page_delimiter
        )
        stem = Path(file.filename).stem
        return PlainTextResponse(
            content=result.combined_text,
            media_type="text/plain; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{stem}.txt"'
            }
        )
    except OCRError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during PDF OCR: {str(e)}"
        )


@router.post(
    "/ocr/image",
    response_model=ImageOCRResponse,
    summary="OCR an image file",
    description="Extracts text directly from an uploaded image (PNG, JPG, TIFF, WEBP, etc.) using Tesseract."
)
async def ocr_image_endpoint(
    file: UploadFile = File(..., description="Image file to OCR"),
    languages: str = Form(DEFAULT_LANGUAGES, description="Tesseract language string (e.g. 'eng+hin')")
):
    content = await _read_and_validate_file(file)

    try:
        result = await process_image(
            image_bytes=content,
            filename=file.filename,
            languages=languages
        )
        return result
    except OCRError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during image OCR: {str(e)}"
        )


@router.post(
    "/ocr/auto",
    summary="Universal OCR endpoint (PDF or Image)",
    description="Automatically detects whether the uploaded file is a PDF or an Image and runs the appropriate OCR pipeline."
)
async def ocr_auto_endpoint(
    file: UploadFile = File(..., description="PDF or Image file to OCR"),
    languages: str = Form(DEFAULT_LANGUAGES, description="Tesseract language string (e.g. 'eng+hin')"),
    dpi: int = Form(DEFAULT_DPI, ge=72, le=600, description="DPI (applicable if file is PDF)"),
    start_page: Optional[int] = Form(None, ge=1, description="First page (if PDF)"),
    end_page: Optional[int] = Form(None, ge=1, description="Last page (if PDF)"),
    page_delimiter: str = Form("\n\n", description="Separator between pages (if PDF)")
):
    content = await _read_and_validate_file(file)
    is_pdf = file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf"

    try:
        if is_pdf:
            return await process_pdf(
                pdf_bytes=content,
                filename=file.filename,
                languages=languages,
                dpi=dpi,
                start_page=start_page,
                end_page=end_page,
                page_delimiter=page_delimiter
            )
        else:
            return await process_image(
                image_bytes=content,
                filename=file.filename,
                languages=languages
            )
    except OCRError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error during OCR: {str(e)}"
        )


@router.get(
    "/languages",
    response_model=LanguagesResponse,
    summary="List available OCR languages",
    description="Returns the list of installed Tesseract language models on the host system."
)
async def list_languages_endpoint():
    available = await get_available_languages()
    return LanguagesResponse(
        available_languages=available,
        default_languages=DEFAULT_LANGUAGES
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    description="Returns system health and version information for Tesseract and pdftoppm."
)
async def health_endpoint():
    tess_ver, pdf_ver = await get_versions()
    langs = await get_available_languages()
    return HealthResponse(
        status="healthy",
        tesseract_version=tess_ver,
        pdftoppm_version=pdf_ver,
        available_languages=langs
    )


@router.post(
    "/ai/organize",
    response_model=AIOrganizeResponse,
    summary="Organize and structure questions using Gemini AI",
    description="Uses Gemini AI to clean OCR text, fix broken Hindi words, convert Hindi numerals to Arabic digits, structure subquestions, and parse tables into Markdown and tabular JSON."
)
async def ai_organize_endpoint(
    payload: AIOrganizeRequest,
    x_gemini_api_key: Optional[str] = Header(None, description="Optional Gemini API key passed via header")
):
    if not payload.text or not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The 'text' field cannot be empty. Please provide OCR text to organize."
        )

    api_key = (payload.api_key and payload.api_key.strip()) or (x_gemini_api_key and x_gemini_api_key.strip()) or os.getenv("GEMINI_API_KEY", "").strip()
    model_name = (payload.model and payload.model.strip()) or os.getenv("GEMINI_MODEL", "gemini-1.5-flash-8b").strip()
    try:
        result = await organize_questions_with_gemini(
            raw_ocr_text=payload.text,
            api_key=api_key,
            model_name=model_name
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error organizing questions with Gemini AI: {str(e)}"
        )


@router.post(
    "/ocr/subject-process",
    response_model=SubjectProcessResponse,
    summary="Process STEM Question Paper with Subject OCR & Diagram Cropping",
    description="Processes PDF or image question papers for Maths (Pix2Text LaTeX), Physics, or Chemistry, automatically detecting and cropping diagrams, and returning structured questions."
)
async def ocr_subject_process_endpoint(
    file: UploadFile = File(..., description="PDF or Image exam paper file"),
    subject_type: str = Form("formula_maths", description="'formula_maths', 'physics', 'chemistry', or 'general'"),
    languages: str = Form(DEFAULT_LANGUAGES, description="Tesseract languages (e.g. 'eng+hin')"),
    dpi: int = Form(DEFAULT_DPI, ge=72, le=600, description="DPI for rendering PDF pages"),
    start_page: Optional[int] = Form(None, ge=1),
    end_page: Optional[int] = Form(None, ge=1),
    paper_name: Optional[str] = Form(None, description="Mains Question Paper Name"),
    paper_year: Optional[int] = Form(None, description="Paper Examination Year (e.g. 2024)"),
    time_limit: Optional[str] = Form("3 hours", description="Time limit for examination, default 3 hours"),
    api_key: Optional[str] = Form(None),
    model: Optional[str] = Form("gemini-1.5-flash-8b"),
    x_gemini_api_key: Optional[str] = Header(None)
):
    start_time = time.perf_counter()
    content = await _read_and_validate_file(file)
    effective_key = (api_key and api_key.strip()) or (x_gemini_api_key and x_gemini_api_key.strip()) or os.getenv("GEMINI_API_KEY", "").strip()
    effective_model = (model and model.strip()) or os.getenv("GEMINI_MODEL", "gemini-1.5-flash-8b").strip()

    is_pdf = file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf"
    all_diagrams: List[DiagramItem] = []
    page_texts: List[str] = []
    engine_used = "Tesseract OCR"

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        png_files: List[Path] = []

        if is_pdf:
            pdf_path = temp_dir / "input.pdf"
            pdf_path.write_bytes(content)
            prefix = "page"
            await run_pdftoppm(
                pdf_path=pdf_path,
                output_prefix=prefix,
                dpi=dpi,
                start_page=start_page,
                end_page=end_page,
                cwd=temp_dir
            )
            png_files = list(temp_dir.glob(f"{prefix}-*.png"))
            png_files.sort(key=lambda p: _extract_page_number(p.name))
        else:
            ext = Path(file.filename).suffix or ".png"
            img_path = temp_dir / f"page-1{ext}"
            img_path.write_bytes(content)
            png_files = [img_path]

        if not png_files:
            raise HTTPException(status_code=400, detail="No readable pages found in uploaded file.")

        # Process each page: text/formula OCR first, then diagram detection
        for idx, png_path in enumerate(png_files, start=1):
            page_num = _extract_page_number(png_path.name) or idx

            # 1. Text / Formula OCR
            text_for_page = ""
            if subject_type == "formula_maths" and is_pix2text_available():
                try:
                    p2t_res = await recognize_math_with_pix2text(png_path)
                    text_for_page = p2t_res.get("latex_text", "").strip()
                    engine_used = "Pix2Text (Math Engine)"
                except Exception as e:
                    print(f"[SubjectProcess] Pix2Text recognition fallback on page {page_num}: {e}")

            # Fallback to Tesseract if empty or other subject
            if not text_for_page:
                out_base = temp_dir / f"ocr_out_{page_num}"
                text_for_page = await run_tesseract_on_file(png_path, out_base, languages=languages)
                if engine_used == "Tesseract OCR" and subject_type == "formula_maths":
                    engine_used = "Tesseract + Math AI"
                elif subject_type == "physics":
                    engine_used = "Tesseract + Physics STEM Engine"
                elif subject_type == "chemistry":
                    engine_used = "Tesseract + Chemistry Engine"

            page_texts.append(text_for_page.rstrip())

            # 2. Diagram Detection & Cropping
            # Check if this page contains a logic circuit or visual diagram
            lower_text = text_for_page.lower()
            page_has_circuit = any(kw in lower_text for kw in ["circuit", "peripath", "परिपथ", "gate", "तर्क परिपथ"])

            boxes = detect_diagram_regions_heuristic(png_path, page_number=page_num, min_height=120)
            try:
                with Image.open(png_path) as page_img:
                    saved_count = 0
                    for b_idx, box in enumerate(boxes):
                        left, top, right, bottom = box
                        crop_slice = page_img.crop((left, top, right, bottom))
                        # Always skip table crops regardless of page
                        if is_table_crop(crop_slice):
                            continue

                        saved_count += 1
                        diag_title = (
                            "Circuit Diagram" if page_has_circuit and len(boxes) == 1
                            else (f"Circuit Diagram (Figure {saved_count})" if page_has_circuit else f"Diagram {saved_count} (Page {page_num})")
                        )
                        diag_item = save_cropped_diagram(
                            img=page_img,
                            bbox=box,
                            question_ref=None,
                            title=diag_title,
                            page_number=page_num
                        )
                        all_diagrams.append(diag_item)
            except Exception as e:
                print(f"[SubjectProcess] Diagram crop warning on page {page_num}: {e}")

    # Build page-annotated text so Gemini knows which questions belong to which page
    annotated_sections = [f"--- PAGE {i} ---\n{txt}" for i, txt in enumerate(page_texts, start=1)]
    combined_text = "\n\n".join(annotated_sections)

    # 3. Structure questions using Subject-Aware Organizer if Gemini Key is available
    questions: List[OrganizedQuestion] = []
    exam_title = f"{subject_type.replace('_', ' ').title()} Exam Paper"

    if effective_key:
        try:
            organized = await organize_subject_questions(
                raw_ocr_text=combined_text,
                subject_type=subject_type,
                diagrams=all_diagrams,
                api_key=effective_key,
                model_name=effective_model,
                page_texts=page_texts
            )
            questions = organized.get("questions", [])
            exam_title = organized.get("exam_title") or exam_title
        except Exception as e:
            print(f"[SubjectProcess] Gemini structuring error: {e}")

    # Fallback structure if no key or error
    if not questions:
        questions = [
            OrganizedQuestion(
                question_number="1",
                section="Section A",
                text_en=combined_text,
                diagrams=[] if subject_type == "formula_maths" else all_diagrams
            )
        ]

    elapsed = round(time.perf_counter() - start_time, 3)
    effective_paper_name = paper_name or exam_title or Path(file.filename).stem

    return SubjectProcessResponse(
        success=True,
        subject_type=subject_type,
        exam_title=effective_paper_name,
        engine_used=engine_used,
        total_questions=len(questions),
        total_diagrams=len(all_diagrams),
        questions=questions,
        diagrams=all_diagrams,
        raw_text=combined_text,
        processing_time_sec=elapsed,
        paper_name=effective_paper_name,
        paper_year=paper_year,
        time_limit=time_limit or "3 hours"
    )


# -------------------------------------------------------------
# OCR-Main's Database Persistence & Lifecycle Endpoints
# -------------------------------------------------------------

@router.get("/ocr-mains/papers", summary="List Mains Question Papers")
async def list_mains_question_papers_endpoint():
    """Retrieves all registered question papers with question count."""
    try:
        papers = get_mains_question_papers()
        return {"success": True, "papers": papers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve question papers: {str(e)}")


@router.get("/ocr-mains/papers/{paper_id}", summary="Get Single Mains Question Paper")
async def get_single_mains_question_paper_endpoint(paper_id: str):
    """Retrieves a single question paper by ID."""
    try:
        paper = get_mains_question_paper_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Question paper not found.")
        return {"success": True, "paper": paper}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve question paper: {str(e)}")


@router.post("/ocr-mains/papers", summary="Create Mains Question Paper")
async def create_mains_question_paper_endpoint(payload: MainsQuestionPaperCreate):
    """Creates or registers a new question paper record."""
    try:
        paper = create_or_get_mains_question_paper(
            paper_name=payload.paper_name,
            paper_year=payload.paper_year,
            time_limit=payload.time_limit or "3 hours",
            subject_type=payload.subject_type or "formula_maths",
            total_marks=payload.total_marks,
            source_filename=payload.source_filename
        )
        return {"success": True, "paper": paper}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create question paper: {str(e)}")


@router.delete("/ocr-mains/papers/{paper_id}", summary="Delete Mains Question Paper")
async def delete_mains_question_paper_endpoint(paper_id: str):
    """Deletes a mains question paper and cascades to delete all linked questions."""
    try:
        deleted = delete_mains_question_paper(paper_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Question paper not found.")
        return {"success": True, "message": "Question paper and linked questions successfully deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question paper: {str(e)}")


@router.post("/ocr-mains/questions", summary="Save OCR Questions to Database")
async def save_ocr_mains_questions_endpoint(payload: OcrMainsSaveBatchRequest):
    """Saves a batch of extracted questions with diagrams and LaTeX formulas into the backend database."""
    try:
        raw_questions = [q.model_dump() for q in payload.questions]
        saved = save_ocr_mains_questions(
            questions=raw_questions,
            source_filename=payload.source_filename,
            default_subject_type=payload.subject_type or "formula_maths",
            paper_id=payload.paper_id,
            paper_name=payload.paper_name,
            paper_year=payload.paper_year,
            time_limit=payload.time_limit or "3 hours"
        )
        return {
            "success": True,
            "message": f"Successfully saved {len(saved)} questions.",
            "count": len(saved),
            "questions": saved
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")


@router.get("/ocr-mains/questions", summary="List OCR Mains Questions")
async def list_ocr_mains_questions_endpoint(
    status: Optional[str] = Query(None, description="Filter by status: 'SAVED', 'APPROVED'"),
    subject_type: Optional[str] = Query(None, description="Filter by subject type"),
    paper_id: Optional[str] = Query(None, description="Filter by paper ID"),
    search: Optional[str] = Query(None, description="Search keyword in text or question number"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """Retrieves saved or approved questions from the backend database with pagination."""
    try:
        data = get_ocr_mains_questions(
            status=status,
            subject_type=subject_type,
            paper_id=paper_id,
            search=search,
            limit=limit,
            offset=offset
        )
        return {"success": True, **data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve questions: {str(e)}")


@router.get("/ocr-mains/questions/{question_id}", summary="Get Single Question by ID")
async def get_ocr_mains_question_endpoint(question_id: str):
    """Fetches full question record with diagrams, formulas, and subquestions."""
    q = get_ocr_mains_question_by_id(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    return {"success": True, "question": q}


@router.put("/ocr-mains/questions/{question_id}", summary="Update Question Details")
async def update_ocr_mains_question_endpoint(question_id: str, payload: OcrMainsQuestionPayload):
    """Updates question text, formulas, diagrams, subquestions, marks, etc."""
    try:
        updated = update_ocr_mains_question(question_id, payload.model_dump(exclude_unset=True))
        if not updated:
            raise HTTPException(status_code=404, detail="Question not found or could not be updated.")
        return {"success": True, "question": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update question: {str(e)}")


@router.patch("/ocr-mains/questions/{question_id}/status", summary="Update Question Status (Approve/Revert)")
async def update_ocr_mains_status_endpoint(question_id: str, payload: OcrMainsStatusUpdateRequest):
    """Transitions a question between 'SAVED' and 'APPROVED' status."""
    try:
        updated = update_ocr_mains_status(question_id, payload.status)
        if not updated:
            raise HTTPException(status_code=404, detail="Question not found.")
        return {"success": True, "question": updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")


@router.post("/ocr-mains/questions/batch-approve", summary="Batch Approve Questions")
async def batch_approve_ocr_mains_endpoint(payload: OcrMainsBatchApproveRequest):
    """Bulk approves multiple question IDs."""
    try:
        count = batch_approve_ocr_mains(payload.ids)
        return {"success": True, "message": f"Successfully approved {count} questions.", "approved_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to batch approve questions: {str(e)}")


@router.delete("/ocr-mains/questions/{question_id}", summary="Delete Question")
async def delete_ocr_mains_question_endpoint(question_id: str):
    """Deletes a question from the database."""
    try:
        deleted = delete_ocr_mains_question(question_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Question not found.")
        return {"success": True, "message": "Question successfully deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete question: {str(e)}")


@router.post("/ocr-mains/diagrams/upload", summary="Upload Custom Diagram Image")
async def upload_diagram_endpoint(file: UploadFile = File(...)):
    """Uploads a custom diagram image, saves it to Utho Cloud storage, and returns DiagramItem."""
    content = await _read_and_validate_file(file)
    try:
        img = Image.open(io.BytesIO(content))
        diag_id = f"diag_{uuid.uuid4().hex[:10]}"
        file_path = DIAGRAMS_DIR / f"{diag_id}.png"

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        img_bytes = buf.getvalue()

        # Local fallback save
        try:
            img.save(file_path, format="PNG", optimize=True)
        except Exception:
            pass

        # Base64 data URL
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        data_url = f"data:image/png;base64,{b64}"

        # Utho Upload
        from app.storage_service import upload_image_to_utho
        utho_url = upload_image_to_utho(
            file_bytes=img_bytes,
            filename=f"{diag_id}.png",
            content_type="image/png",
            folder="ocr-diagrams"
        )
        image_url = utho_url or f"/static/diagrams/{diag_id}.png"

        return {
            "success": True,
            "diagram": {
                "id": diag_id,
                "title": Path(file.filename).stem or "Uploaded Diagram",
                "page_number": 1,
                "image_url": image_url,
                "data_url": data_url,
                "width": img.width,
                "height": img.height
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process uploaded diagram image: {str(e)}")

