import asyncio
import os
import re
import shutil
import tempfile
import time
from pathlib import Path
from typing import List, Optional, Tuple

from app.config import DEFAULT_DPI, DEFAULT_LANGUAGES, OCR_TIMEOUT_SECONDS
from app.schemas import PageOCRResult, PDFOCRResponse, ImageOCRResponse


class OCRError(Exception):
    """Custom exception raised for OCR processing errors."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _extract_page_number(filename: str) -> int:
    """Extract page number from pdftoppm generated filename (e.g. page-1.png -> 1)."""
    matches = re.findall(r"\d+", filename)
    if matches:
        return int(matches[-1])
    return 0


async def get_available_languages() -> List[str]:
    """Retrieve list of installed Tesseract languages."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "tesseract", "--list-langs",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            return ["eng"]
        
        lines = stdout.decode("utf-8", errors="ignore").strip().splitlines()
        # First line usually header: 'List of available languages...'
        langs = [line.strip() for line in lines[1:] if line.strip()]
        return langs if langs else ["eng"]
    except Exception:
        return ["eng"]


async def get_versions() -> Tuple[str, str]:
    """Retrieve version strings for tesseract and pdftoppm."""
    tess_ver = "unknown"
    pdf_ver = "unknown"
    
    try:
        proc = await asyncio.create_subprocess_exec(
            "tesseract", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        tess_ver = stdout.decode().splitlines()[0].strip()
    except Exception:
        pass

    try:
        proc = await asyncio.create_subprocess_exec(
            "pdftoppm", "-v",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()
        # pdftoppm outputs version info to stderr
        pdf_ver = stderr.decode().splitlines()[0].strip()
    except Exception:
        pass

    return tess_ver, pdf_ver


async def run_pdftoppm(
    pdf_path: Path,
    output_prefix: str,
    dpi: int = DEFAULT_DPI,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    cwd: Optional[Path] = None
) -> None:
    """Run pdftoppm on a PDF file to extract PNG page images."""
    cmd = ["pdftoppm", "-r", str(dpi), "-png"]
    if start_page is not None and start_page > 0:
        cmd.extend(["-f", str(start_page)])
    if end_page is not None and end_page > 0:
        cmd.extend(["-l", str(end_page)])
    cmd.extend([str(pdf_path), output_prefix])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(cwd) if cwd else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=OCR_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise OCRError("pdftoppm process timed out during page extraction.", status_code=504)

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore").strip()
        raise OCRError(f"pdftoppm failed (code {proc.returncode}): {err_msg}", status_code=400)


async def run_tesseract_on_file(
    image_path: Path,
    output_base: Path,
    languages: str = DEFAULT_LANGUAGES
) -> str:
    """Run Tesseract on a single image and return recognized text."""
    cmd = [
        "tesseract",
        str(image_path),
        str(output_base),
        "-l", languages
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=OCR_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise OCRError(f"Tesseract timed out processing {image_path.name}.", status_code=504)

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="ignore").strip()
        raise OCRError(f"Tesseract OCR failed: {err_msg}", status_code=400)

    txt_file = Path(f"{output_base}.txt")
    if not txt_file.exists():
        raise OCRError(f"OCR output file {txt_file.name} was not generated.", status_code=500)

    try:
        return txt_file.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        raise OCRError(f"Failed to read OCR output text: {str(e)}", status_code=500)


async def process_pdf(
    pdf_bytes: bytes,
    filename: str,
    languages: str = DEFAULT_LANGUAGES,
    dpi: int = DEFAULT_DPI,
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    page_delimiter: str = "\n\n"
) -> PDFOCRResponse:
    """Complete workflow: pdftoppm -> tesseract page-*.png -> combined text."""
    start_time = time.perf_counter()

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        pdf_file = temp_dir / "input.pdf"
        pdf_file.write_bytes(pdf_bytes)

        # 1. pdftoppm -r 300 -png input.pdf page
        prefix = "page"
        await run_pdftoppm(
            pdf_path=pdf_file,
            output_prefix=prefix,
            dpi=dpi,
            start_page=start_page,
            end_page=end_page,
            cwd=temp_dir
        )

        # 2. Collect generated page-*.png files
        png_files = list(temp_dir.glob(f"{prefix}-*.png"))
        if not png_files:
            raise OCRError("No pages were rendered from the provided PDF file.", status_code=400)

        # Sort naturally by page number (page-1.png, page-2.png, ..., page-10.png)
        png_files.sort(key=lambda p: _extract_page_number(p.name))

        # 3. Run tesseract on each page
        pages: List[PageOCRResult] = []
        for index, png_path in enumerate(png_files, start=1):
            out_base = temp_dir / f"output_page_{index}"
            page_text = await run_tesseract_on_file(
                image_path=png_path,
                output_base=out_base,
                languages=languages
            )
            # Normalize whitespace/line endings if needed
            cleaned_text = page_text.rstrip()
            pages.append(
                PageOCRResult(
                    page_number=_extract_page_number(png_path.name) or index,
                    text=cleaned_text,
                    char_count=len(cleaned_text),
                    word_count=len(cleaned_text.split())
                )
            )

        # 4. cat page-*.txt > upsc12.txt equivalent
        combined_text = page_delimiter.join(p.text for p in pages)
        elapsed = round(time.perf_counter() - start_time, 3)

        return PDFOCRResponse(
            success=True,
            filename=filename,
            total_pages=len(pages),
            languages=languages,
            dpi=dpi,
            processing_time_sec=elapsed,
            combined_text=combined_text,
            pages=pages
        )


async def process_image(
    image_bytes: bytes,
    filename: str,
    languages: str = DEFAULT_LANGUAGES
) -> ImageOCRResponse:
    """Run Tesseract directly on a single image file."""
    start_time = time.perf_counter()

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        ext = Path(filename).suffix or ".png"
        img_path = temp_dir / f"input{ext}"
        img_path.write_bytes(image_bytes)

        out_base = temp_dir / "output"
        text = await run_tesseract_on_file(
            image_path=img_path,
            output_base=out_base,
            languages=languages
        )
        cleaned_text = text.rstrip()
        elapsed = round(time.perf_counter() - start_time, 3)

        return ImageOCRResponse(
            success=True,
            filename=filename,
            languages=languages,
            processing_time_sec=elapsed,
            text=cleaned_text,
            char_count=len(cleaned_text),
            word_count=len(cleaned_text.split())
        )
