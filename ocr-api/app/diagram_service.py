import base64
import io
import os
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

from PIL import Image, ImageOps, ImageFilter
from app.schemas import DiagramItem

DIAGRAMS_DIR = Path(__file__).resolve().parent / "static" / "diagrams"
DIAGRAMS_DIR.mkdir(parents=True, exist_ok=True)


from app.storage_service import upload_image_to_utho

def save_cropped_diagram(
    img: Image.Image,
    bbox: Tuple[int, int, int, int],  # (left, top, right, bottom)
    question_ref: Optional[str] = None,
    title: Optional[str] = "Diagram / Circuit",
    page_number: int = 1,
    padding: int = 12
) -> DiagramItem:
    """
    Crops a diagram from an Image, adds padding, saves it to Utho Cloud Object Storage
    (with local static fallback), and returns a DiagramItem schema.
    """
    w, h = img.size
    left, top, right, bottom = bbox

    # Apply padding within bounds
    pad_left = max(0, left - padding)
    pad_top = max(0, top - padding)
    pad_right = min(w, right + padding)
    pad_bottom = min(h, bottom + padding)

    cropped = img.crop((pad_left, pad_top, pad_right, pad_bottom))
    crop_w, crop_h = cropped.size

    diagram_id = f"diag_{uuid.uuid4().hex[:10]}"
    file_path = DIAGRAMS_DIR / f"{diagram_id}.png"

    # Save to memory buffer
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG", optimize=True)
    img_bytes = buffer.getvalue()

    # Also save to local static directory as immediate local fallback
    try:
        cropped.save(file_path, format="PNG", optimize=True)
    except Exception as e:
        print(f"[DiagramService] Local file save warning: {e}")

    # Compute base64 data url for instant embedding
    b64_str = base64.b64encode(img_bytes).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    # Upload to Utho Cloud Object Storage
    utho_url = upload_image_to_utho(
        file_bytes=img_bytes,
        filename=f"{diagram_id}.png",
        content_type="image/png",
        folder="ocr-diagrams"
    )

    image_url = utho_url or f"/static/diagrams/{diagram_id}.png"

    return DiagramItem(
        id=diagram_id,
        question_ref=question_ref,
        title=title or "Diagram / Circuit Figure",
        page_number=page_number,
        image_url=image_url,
        data_url=data_url,
        width=crop_w,
        height=crop_h,
        bounding_box=[pad_top, pad_left, pad_bottom, pad_right]
    )


def is_table_crop(img: Image.Image) -> bool:
    """Detect if an image is a boxed table with continuous grid borders rather than an open circuit drawing."""
    try:
        w, h = img.size
        if w < 50 or h < 50:
            return False
        gray = ImageOps.grayscale(img)
        bw = gray.point(lambda x: 255 if x < 128 else 0, mode="1")
        bw_data = bw.load()

        # Count distinct horizontal grid lines
        h_lines = []
        for y in range(h):
            black_in_row = sum(1 for x in range(w) if bw_data[x, y] == 255)
            if black_in_row > (w * 0.70):
                if not h_lines or (y - h_lines[-1]) > 10:
                    h_lines.append(y)

        # Count distinct vertical grid lines
        v_lines = []
        for x in range(w):
            black_in_col = sum(1 for y in range(h) if bw_data[x, y] == 255)
            if black_in_col > (h * 0.60):
                if not v_lines or (x - v_lines[-1]) > 10:
                    v_lines.append(x)

        # Genuine table grids have at least 3 distinct horizontal lines and at least 3 distinct vertical lines,
        # or 4+ horizontal rows. Simple framed diagrams only have 2 horizontal and 2 vertical boundary edges.
        if (len(h_lines) >= 3 and len(v_lines) >= 3) or len(h_lines) >= 4:
            return True
    except Exception:
        pass
    return False


def detect_diagram_regions_heuristic(
    image_path: Path,
    page_number: int = 1,
    min_width: int = 100,
    min_height: int = 120
) -> List[Tuple[int, int, int, int]]:
    """
    Heuristic computer vision detection of non-text drawings/diagrams/circuits
    based on spatial density of dark pixels and bounding box aspect ratios.
    """
    detected_boxes: List[Tuple[int, int, int, int]] = []
    try:
        with Image.open(image_path) as img:
            rgb_img = img.convert("RGB")
            gray = ImageOps.grayscale(rgb_img)
            # Threshold to binary (dark ink on light background)
            bw = gray.point(lambda x: 255 if x < 180 else 0, mode="1")
            
            # Subsample for faster grid analysis if image is large
            w, h = bw.size
            grid_size = 20
            gw, gh = w // grid_size, h // grid_size
            
            # Build 2D occupancy grid
            grid = [[0 for _ in range(gw)] for _ in range(gh)]
            bw_data = bw.load()
            for y in range(gh):
                for x in range(gw):
                    # Count dark pixels in this cell
                    dark_count = sum(
                        1 for cy in range(y * grid_size, min((y + 1) * grid_size, h), 4)
                        for cx in range(x * grid_size, min((x + 1) * grid_size, w), 4)
                        if bw_data[cx, cy] == 255
                    )
                    if dark_count >= 3:
                        grid[y][x] = 1

            # Connected component bounding boxes on grid
            visited = [[False for _ in range(gw)] for _ in range(gh)]
            for y in range(gh):
                for x in range(gw):
                    if grid[y][x] == 1 and not visited[y][x]:
                        # Flood fill
                        queue = [(x, y)]
                        visited[y][x] = True
                        min_x, max_x = x, x
                        min_y, max_y = y, y
                        cell_count = 0

                        while queue:
                            cx, cy = queue.pop(0)
                            cell_count += 1
                            min_x, max_x = min(min_x, cx), max(max_x, cx)
                            min_y, max_y = min(min_y, cy), max(max_y, cy)

                            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)]:
                                nx, ny = cx + dx, cy + dy
                                if 0 <= nx < gw and 0 <= ny < gh:
                                    if grid[ny][nx] == 1 and not visited[ny][nx]:
                                        visited[ny][nx] = True
                                        queue.append((nx, ny))

                        pixel_w = (max_x - min_x + 1) * grid_size
                        pixel_h = (max_y - min_y + 1) * grid_size

                        # Filter for diagram/circuit characteristics:
                        # Diagrams are multi-line, taller than typical text lines (>120px),
                        # have substantial area, and not just a full-page text block.
                        if (
                            pixel_w >= min_width and
                            pixel_h >= min_height and
                            (pixel_w * pixel_h) >= 15000 and
                            pixel_h < (h * 0.7) and
                            pixel_w < (w * 0.95) and
                            cell_count >= 20
                        ):
                            # Ratio check: text lines are wide and short (aspect > 8).
                            # Diagrams tend to be more square or boxed.
                            aspect = pixel_w / float(pixel_h)
                            if 0.3 <= aspect <= 4.5:
                                box = (
                                    min_x * grid_size,
                                    min_y * grid_size,
                                    (max_x + 1) * grid_size,
                                    (max_y + 1) * grid_size
                                )
                                detected_boxes.append(box)
    except Exception as e:
        print(f"[DiagramService] Error in heuristic detection: {e}")

    return detected_boxes


def extract_diagrams_from_normalized_boxes(
    image_path: Path,
    boxes: List[Dict[str, Any]],
    page_number: int = 1
) -> List[DiagramItem]:
    """
    Extracts diagrams given normalized boxes [ymin, xmin, ymax, xmax] (0 to 1000 scale).
    """
    diagrams: List[DiagramItem] = []
    if not image_path.exists():
        return diagrams

    try:
        with Image.open(image_path) as img:
            w, h = img.size
            for item in boxes:
                raw_box = item.get("box") or item.get("bounding_box")
                if not raw_box or len(raw_box) != 4:
                    continue
                
                ymin, xmin, ymax, xmax = raw_box
                left = int((xmin / 1000.0) * w)
                top = int((ymin / 1000.0) * h)
                right = int((xmax / 1000.0) * w)
                bottom = int((ymax / 1000.0) * h)

                # Ensure valid dimensions
                if right > left + 20 and bottom > top + 20:
                    diag = save_cropped_diagram(
                        img=img,
                        bbox=(left, top, right, bottom),
                        question_ref=item.get("question_ref"),
                        title=item.get("title", "Diagram / Circuit Figure"),
                        page_number=page_number
                    )
                    diagrams.append(diag)
    except Exception as e:
        print(f"[DiagramService] Error cropping normalized boxes: {e}")

    return diagrams
