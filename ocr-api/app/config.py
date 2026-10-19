import os
from pathlib import Path
from dotenv import load_dotenv

# 1. Load from ocr-api/.env if it exists
_ocr_env = Path(__file__).resolve().parent.parent / ".env"
if _ocr_env.exists():
    load_dotenv(_ocr_env)

# 2. Also load from backend/.env (syncs with backend env variables)
_backend_env = Path(__file__).resolve().parent.parent.parent / "backend" / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env, override=False)

# Auto-configure TESSDATA_PREFIX:
# In Linux / Docker, system packages install models to /usr/share/tesseract-ocr/5/tessdata or /usr/share/tesseract-ocr/4.00/tessdata
if "TESSDATA_PREFIX" not in os.environ:
    _system_paths = [
        Path("/usr/share/tesseract-ocr/5/tessdata"),
        Path("/usr/share/tesseract-ocr/4.00/tessdata"),
        Path("/usr/share/tesseract-ocr/tessdata"),
        Path("/usr/share/tessdata"),
    ]
    for sp in _system_paths:
        if sp.exists() and (sp / "eng.traineddata").exists():
            os.environ["TESSDATA_PREFIX"] = str(sp)
            break

# Fallback to local project tessdata directory if available and system path was not found
if "TESSDATA_PREFIX" not in os.environ:
    _project_tessdata = Path(__file__).resolve().parent.parent / "tessdata"
    if _project_tessdata.exists() and (_project_tessdata / "eng.traineddata").exists():
        os.environ["TESSDATA_PREFIX"] = str(_project_tessdata)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash-8b").strip()
DEFAULT_LANGUAGES = os.getenv("OCR_DEFAULT_LANGUAGES", "eng+hin")
DEFAULT_DPI = int(os.getenv("OCR_DEFAULT_DPI", "300"))
MAX_FILE_SIZE_MB = int(os.getenv("OCR_MAX_FILE_SIZE_MB", "100"))
OCR_TIMEOUT_SECONDS = int(os.getenv("OCR_TIMEOUT_SECONDS", "300"))
