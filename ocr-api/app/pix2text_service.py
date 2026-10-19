import asyncio
import logging
from pathlib import Path
from typing import Optional, Union, Dict, Any, List
from PIL import Image

logger = logging.getLogger("pix2text_service")

_p2t_instance = None
_p2t_initialized = False
_p2t_error = None


def is_pix2text_available() -> bool:
    """Check if pix2text is installed and can be imported."""
    try:
        import pix2text
        return True
    except ImportError:
        return False


def get_pix2text_instance():
    """Lazy-load singleton instance of Pix2Text for formula-based mathematics."""
    global _p2t_instance, _p2t_initialized, _p2t_error
    if _p2t_initialized:
        return _p2t_instance

    try:
        from pix2text import Pix2Text
        logger.info("Initializing Pix2Text engine for mathematical formula recognition...")
        # Initialize with standard formula and text capabilities
        _p2t_instance = Pix2Text.from_config()
        _p2t_initialized = True
        logger.info("Pix2Text engine successfully initialized.")
        return _p2t_instance
    except Exception as e:
        _p2t_error = str(e)
        logger.warning(f"Pix2Text initialization notice: {e}")
        _p2t_initialized = True
        _p2t_instance = None
        return None


def _run_p2t_sync(image_path_or_img: Union[str, Path, Image.Image]) -> Dict[str, Any]:
    """Synchronous worker function to run Pix2Text recognition."""
    p2t = get_pix2text_instance()
    if p2t is None:
        raise RuntimeError(f"Pix2Text engine is not loaded: {_p2t_error or 'Module not available'}")

    # Pix2Text recognize supports file path, PIL Image, or numpy array
    if isinstance(image_path_or_img, Path):
        image_input = str(image_path_or_img)
    else:
        image_input = image_path_or_img

    # Try recognize_text_formula or recognize
    if hasattr(p2t, "recognize_text_formula"):
        result = p2t.recognize_text_formula(image_input)
    elif hasattr(p2t, "recognize"):
        result = p2t.recognize(image_input)
    else:
        raise RuntimeError("Pix2Text instance has no recognize method.")

    # Format result string
    if isinstance(result, str):
        latex_text = result
    elif isinstance(result, list):
        # List of elements (text, formulas)
        latex_text = "\n".join(
            item.get("text", "") if isinstance(item, dict) else str(item)
            for item in result
        )
    elif isinstance(result, dict):
        latex_text = result.get("text") or str(result)
    else:
        latex_text = str(result)

    return {
        "latex_text": latex_text,
        "engine": "pix2text"
    }


async def recognize_math_with_pix2text(
    image_path_or_img: Union[str, Path, Image.Image]
) -> Dict[str, Any]:
    """
    Asynchronously recognizes math equations and formulas using Pix2Text in a thread.
    Returns LaTeX text with $ inline $ and $$ display $$ math formulas.
    """
    return await asyncio.to_thread(_run_p2t_sync, image_path_or_img)
