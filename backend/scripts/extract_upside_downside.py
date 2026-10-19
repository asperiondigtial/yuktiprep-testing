import sys
import os
os.environ["PADDLE_WITH_ONEDNN"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_use_onednn"] = "0"
os.environ["PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["PADDLE_PDX_ENABLE_MODEL_CACHE"] = "True"

import warnings
warnings.filterwarnings("ignore", category=UserWarning)

import re
import json
from pathlib import Path
from PIL import Image
from paddleocr import PaddleOCR

# Ensure standard output and file writing support UTF-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DEVANAGARI_RANGE = range(0x0900, 0x097F + 1)

def has_devanagari(text: str) -> bool:
    return any(ord(ch) in DEVANAGARI_RANGE for ch in text)

def clean_text(text: str) -> str:
    """Clean OCR spacing, punctuation artifacts, and noise symbols."""
    if not text:
        return ""
    text = re.sub(r'0%0|\$2\$|TUKU-\d+', '', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def merge_boxes_into_lines(boxes, y_thresh=14.0):
    """Cluster boxes that share similar vertical center (cy) and sort left-to-right."""
    if not boxes:
        return []

    sorted_boxes = sorted(boxes, key=lambda b: b['cy'])
    lines = []
    current_line = [sorted_boxes[0]]

    for b in sorted_boxes[1:]:
        avg_cy = sum(item['cy'] for item in current_line) / len(current_line)
        if abs(b['cy'] - avg_cy) <= y_thresh:
            current_line.append(b)
        else:
            current_line.sort(key=lambda item: item['x1'])
            lines.append(current_line)
            current_line = [b]

    if current_line:
        current_line.sort(key=lambda item: item['x1'])
        lines.append(current_line)

    return lines

def filter_page_boxes(boxes):
    """Remove headers, footers (KVMS codes, page numbers) and prepare boxes."""
    filtered = []
    for b in boxes:
        txt = b['text'].strip()
        if not txt:
            continue
        
        # Header noise (e.g., SECTION A, खण्ड, OSOS)
        if b['y2'] < 160 and ('section' in txt.lower() or 'खण्ड' in txt or 'osos' in txt.lower()):
            continue
            
        # Footer noise (e.g., KVMS-B-CVG, page numbers at page bottom)
        if b['y1'] > 1400 and ('kvms' in txt.lower() or txt.isdigit()):
            continue

        filtered.append(b)
    return filtered

def parse_document_questions(pages_boxes):
    """
    Parse multi-page upside-downside / stacked question papers.
    In UPSC papers:
    - Main question is Q1, Q2, Q3, etc.
    - Each question contains sub-parts: (a), (b), (c), (d), (e).
    - Sub-parts can carry over onto subsequent pages (e.g. Q1(e) on Page 2).
    - Right margin numbers are extracted as marks, not merged into question body.
    - Tables of numbers (e.g. 1-2, 2-5) are preserved inside questions and not treated as new questions.
    """
    questions = []
    curr_q = None
    curr_part = None

    for page_idx, p_boxes in enumerate(pages_boxes):
        valid_boxes = filter_page_boxes(p_boxes)
        lines = merge_boxes_into_lines(valid_boxes)

        for line in lines:
            line_str = " ".join(b['text'] for b in line).strip()
            if not line_str:
                continue

            marks_match = None
            # Detect margin mark (isolated 1-2 digits on the far right)
            if line and line[-1]['x1'] > 900 and re.fullmatch(r'\d{1,2}', line[-1]['text'].strip()):
                marks_match = line[-1]['text'].strip()
                line_str = " ".join(b['text'] for b in line[:-1]).strip()

            if not line_str:
                continue

            # Check if this line starts a NEW main question: e.g. "Q1. (a)", "Q2.", "1."
            m_q = re.match(r'^(?:Q(?:uestion|\.)?\s*)?(\d{1,3})[.:\)]\s*(.*)$', line_str, re.IGNORECASE)
            is_table_range = bool(re.match(r'^\d{1,3}\s*[-–—]\s*\d{1,3}', line_str))
            is_explicit_q = bool(re.match(r'^Q(?:uestion|\.)?\s*\d{1,3}', line_str, re.IGNORECASE))

            if m_q and not is_table_range and (is_explicit_q or not curr_q or int(m_q.group(1)) > curr_q['number']):
                q_num = int(m_q.group(1))
                rem = m_q.group(2).strip()
                curr_q = {
                    'number': q_num,
                    'parts': [],
                    'english_lines': [],
                    'hindi_lines': [],
                    'marks': marks_match
                }
                questions.append(curr_q)
                curr_part = None
                line_str = rem

            # If page begins with a continuation part (e.g. (e) of Q1)
            if not curr_q and questions:
                curr_q = questions[-1]

            # Detect sub-part: (a), (b), (c), (d), (e) or OCR typo '()' where 'c' was lost
            m_part = re.match(r'^\(([a-eA-E])\)\s*(.*)$', line_str)
            m_empty_paren = re.match(r'^\(\s*\)\s*(.*)$', line_str)

            if m_part:
                part_label = m_part.group(1).lower()
                rem = m_part.group(2).strip()
                curr_part = {
                    'label': part_label,
                    'english_lines': [],
                    'hindi_lines': [],
                    'marks': marks_match
                }
                curr_q['parts'].append(curr_part)
                line_str = rem
            elif m_empty_paren and curr_q and curr_q['parts'] and curr_q['parts'][-1]['label'] == 'b':
                part_label = 'c'
                rem = m_empty_paren.group(1).strip()
                curr_part = {
                    'label': part_label,
                    'english_lines': [],
                    'hindi_lines': [],
                    'marks': marks_match
                }
                curr_q['parts'].append(curr_part)
                line_str = rem

            if not line_str:
                continue

            # Route text to the active sub-part or main question block
            target = curr_part if curr_part else curr_q
            if target:
                if has_devanagari(line_str):
                    target['hindi_lines'].append(line_str)
                else:
                    target['english_lines'].append(line_str)
                if marks_match and not target.get('marks'):
                    target['marks'] = marks_match

    # Build structured output
    results = []
    for q in questions:
        q_num = q['number']
        parts = q.get('parts', [])

        if parts:
            eng_subparts = []
            hin_subparts = []
            marks_list = []

            for p in parts:
                lbl = f"({p['label']})"
                eng_txt = clean_text(" ".join(p['english_lines']))
                hin_txt = clean_text(" ".join(p['hindi_lines']))
                p_mark = p.get('marks')
                if p_mark:
                    marks_list.append(str(p_mark))

                if eng_txt:
                    eng_subparts.append(f"{lbl} {eng_txt}" + (f" [{p_mark} Marks]" if p_mark else ""))
                if hin_txt:
                    hin_subparts.append(f"{lbl} {hin_txt}" + (f" [{p_mark} अंक]" if p_mark else ""))

            results.append({
                "number": q_num,
                "english": {
                    "question": clean_text("\n\n".join(eng_subparts)),
                    "metadata": " ".join(marks_list)
                },
                "hindi": {
                    "question": clean_text("\n\n".join(hin_subparts)),
                    "metadata": " ".join(marks_list)
                }
            })
        else:
            eng_txt = clean_text(" ".join(q.get('english_lines', [])))
            hin_txt = clean_text(" ".join(q.get('hindi_lines', [])))
            meta = str(q.get('marks') or "")

            results.append({
                "number": q_num,
                "english": {
                    "question": eng_txt,
                    "metadata": meta
                },
                "hindi": {
                    "question": hin_txt,
                    "metadata": meta
                }
            })

    return results

def load_input_image_paths(file_path: str):
    image_paths = []
    created_temp_files = []
    if file_path.lower().endswith(".pdf"):
        import pymupdf
        import tempfile
        import time
        doc = pymupdf.open(file_path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
            tmp_path = os.path.join(tempfile.gettempdir(), f"yukti_page_{int(time.time()*1000)}_{page_idx}.png")
            pix.save(tmp_path)
            image_paths.append(tmp_path)
            created_temp_files.append(tmp_path)
        doc.close()
    else:
        image_paths.append(file_path)
    return image_paths, created_temp_files

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python extract_upside_downside.py <pdf_or_image_path>\n")
        print(json.dumps([]))
        return

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        sys.stderr.write(f"Error: {input_path} not found.\n")
        print(json.dumps([]))
        return

    try:
        image_paths, temp_files = load_input_image_paths(input_path)
        pages_boxes = []

        ocr = PaddleOCR(
            lang="hi",
            enable_mkldnn=False,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False
        )

        for i, img_path in enumerate(image_paths):
            sys.stderr.write(f"[PDF/Image] Processing Stacked Page {i+1}/{len(image_paths)}...\n")
            predict_res = ocr.predict(str(img_path))[0]
            rec_boxes = predict_res.get("rec_boxes", [])
            rec_texts = predict_res.get("rec_texts", [])

            boxes = []
            for box, text in zip(rec_boxes, rec_texts):
                x1, y1, x2, y2 = box
                boxes.append({
                    'box': box,
                    'text': text,
                    'cx': (x1 + x2) / 2.0,
                    'cy': (y1 + y2) / 2.0,
                    'x1': x1,
                    'y1': y1,
                    'x2': x2,
                    'y2': y2
                })
            pages_boxes.append(boxes)

        all_results = parse_document_questions(pages_boxes)

        # Cleanup temp files
        for tmp_f in temp_files:
            try:
                if os.path.exists(tmp_f):
                    os.remove(tmp_f)
            except Exception:
                pass

        print(json.dumps(all_results, ensure_ascii=False, indent=2))
    except Exception as e:
        sys.stderr.write(f"Extraction failed: {e}\n")
        import traceback
        traceback.print_exc(file=sys.stderr)
        print(json.dumps([]))

if __name__ == "__main__":
    main()
