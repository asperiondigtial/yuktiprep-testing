import io
import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from main import app


def create_sample_pdf() -> bytes:
    """Generate a multi-page PDF in-memory for testing."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    # Page 1
    c.setFont("Helvetica-Bold", 24)
    c.drawString(100, 700, "UPSC Examination Paper - Page 1")
    c.setFont("Helvetica", 16)
    c.drawString(100, 650, "General Studies Question 1: What is Federalism?")
    c.showPage()
    
    # Page 2
    c.setFont("Helvetica-Bold", 24)
    c.drawString(100, 700, "UPSC Examination Paper - Page 2")
    c.setFont("Helvetica", 16)
    c.drawString(100, 650, "Question 2: Explain Economic Growth in India.")
    c.showPage()
    
    c.save()
    return buffer.getvalue()


def create_sample_image() -> bytes:
    """Generate a simple test image in-memory."""
    img = Image.new("RGB", (600, 200), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((50, 80), "Hello Tesseract OCR Engine", fill=(0, 0, 0))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "tesseract_version" in data
        assert "pdftoppm_version" in data
        assert "eng" in data["available_languages"]


@pytest.mark.asyncio
async def test_list_languages():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/languages")
        assert resp.status_code == 200
        data = resp.json()
        assert "eng" in data["available_languages"]
        assert "hin" in data["available_languages"]
        assert "tam" in data["available_languages"]
        assert "tel" in data["available_languages"]
        assert "kan" in data["available_languages"]
        assert data["default_languages"] == "eng+hin"


@pytest.mark.asyncio
async def test_pdf_ocr_workflow():
    pdf_bytes = create_sample_pdf()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ocr/pdf",
            files={"file": ("upsc_test.pdf", pdf_bytes, "application/pdf")},
            data={"languages": "eng+hin", "dpi": "150"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["filename"] == "upsc_test.pdf"
        assert data["total_pages"] == 2
        assert len(data["pages"]) == 2
        assert "Page 1" in data["pages"][0]["text"] or "Federalism" in data["pages"][0]["text"]
        assert "Page 2" in data["pages"][1]["text"] or "Economic" in data["pages"][1]["text"]
        assert len(data["combined_text"]) > 0


@pytest.mark.asyncio
async def test_pdf_text_endpoint():
    pdf_bytes = create_sample_pdf()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ocr/pdf/text",
            files={"file": ("upsc12.pdf", pdf_bytes, "application/pdf")},
            data={"languages": "eng+hin", "dpi": "150"}
        )
        assert resp.status_code == 200
        assert "text/plain" in resp.headers["content-type"]
        text = resp.text
        assert len(text) > 0


@pytest.mark.asyncio
async def test_image_ocr():
    img_bytes = create_sample_image()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ocr/image",
            files={"file": ("sample.png", img_bytes, "image/png")},
            data={"languages": "eng"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "Hello" in data["text"] or "OCR" in data["text"]


@pytest.mark.asyncio
async def test_regional_languages_ocr():
    img_bytes = create_sample_image()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ocr/image",
            files={"file": ("sample.png", img_bytes, "image/png")},
            data={"languages": "eng+tam+tel+kan"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["languages"] == "eng+tam+tel+kan"
        assert len(data["text"]) > 0


@pytest.mark.asyncio
async def test_invalid_file_type():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ocr/pdf",
            files={"file": ("document.txt", b"plain text", "text/plain")}
        )
        assert resp.status_code == 400


def test_devanagari_numerals_normalization():
    from app.ai_service import normalize_devanagari_numerals
    hindi_text = "प्रश्न १: वर्ष २०१९ में (क) १० अंक और (ख) ५ अंक"
    normalized = normalize_devanagari_numerals(hindi_text)
    assert "प्रश्न 1: वर्ष 2019 में (क) 10 अंक और (ख) 5 अंक" == normalized


def test_indic_numerals_normalization():
    from app.ai_service import normalize_indic_numerals
    # Tamil numerals
    tamil_text = "வினா ௧: ஆண்டு ௨௦௨௪ - மதிப்பெண் ௫"
    assert "வினா 1: ஆண்டு 2024 - மதிப்பெண் 5" == normalize_indic_numerals(tamil_text)
    
    # Telugu numerals
    telugu_text = "ప్రశ్న ౧: సంవత్సరం ౨౦౨౪ - మార్కులు ౧౦"
    assert "ప్రశ్న 1: సంవత్సరం 2024 - మార్కులు 10" == normalize_indic_numerals(telugu_text)
    
    # Kannada numerals
    kannada_text = "ಪ್ರಶ್ನೆ ೧: ವರ್ಷ ೨೦೨೪ - ಅಂಕಗಳು ೫"
    assert "ಪ್ರಶ್ನೆ 1: ವರ್ಷ 2024 - ಅಂಕಗಳು 5" == normalize_indic_numerals(kannada_text)


def test_ai_multilingual_schema_with_subheadings():
    from app.schemas import OrganizedQuestion, SubQuestion, AIOrganizeResponse
    sq = SubQuestion(
        subquestion_number="1(a)",
        subheading="பகுதி அ துணை வினா / ఉప విభాగం",
        marks="5 Marks",
        text_en="Explain federal principles.",
        text_hi="संघीय सिद्धांतों की व्याख्या करें।",
        text_ta="கூட்டாட்சி கோட்பாடுகளை விளக்குக.",
        text_te="సమాఖ్య సూత్రాలను వివరించండి.",
        text_kn="ಒಕ್ಕೂಟ ತತ್ವಗಳನ್ನು ವಿವರಿಸಿ."
    )
    q = OrganizedQuestion(
        question_number="1",
        section="Section A",
        subheading="Polity and Governance / அரசியல் அமைப்பு / రాజ్యాంగం",
        marks="10 Marks",
        text_en="Discuss Indian Constitution.",
        text_hi="भारतीय संविधान पर चर्चा करें।",
        text_ta="இந்திய அரசியலமைப்பை விவாதிக்கவும்.",
        text_te="భారత రాజ్యాంగంపై చర్చించండి.",
        text_kn="ಭಾರತೀಯ ಸಂವಿಧಾನದ ಬಗ್ಗೆ ಚರ್ಚಿಸಿ.",
        subquestions=[sq]
    )
    resp = AIOrganizeResponse(total_questions=1, questions=[q])
    assert resp.questions[0].subheading == "Polity and Governance / அரசியல் அமைப்பு / రాజ్యాంగం"
    assert resp.questions[0].text_ta == "இந்திய அரசியலமைப்பை விவாதிக்கவும்."
    assert resp.questions[0].text_te == "భారత రాజ్యాంగంపై చర్చించండి."
    assert resp.questions[0].text_kn == "ಭಾರತೀಯ ಸಂವಿಧಾನದ ಬಗ್ಗೆ ಚರ್ಚಿಸಿ."
    assert resp.questions[0].subquestions[0].subheading == "பகுதி அ துணை வினா / ఉప విభాగం"
    assert resp.questions[0].subquestions[0].text_ta == "கூட்டாட்சி கோட்பாடுகளை விளக்குக."


@pytest.mark.asyncio
async def test_ai_organize_missing_key():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ai/organize",
            json={"text": "Question 1: What is Federalism?"}
        )
        # Should return 401 when neither API key in payload nor env is provided
        assert resp.status_code == 401
        assert "Gemini API key is required" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_ai_organize_empty_text():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/ai/organize",
            json={"text": "   ", "api_key": "dummy_key"}
        )
        assert resp.status_code == 400
        assert "cannot be empty" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_subject_process_maths_and_diagram():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create a sample test image with a box diagram
        img = Image.new("RGB", (600, 600), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), "SECTION A: Q1. Find limit of f(x) = lim (a^x + sin x) / x", fill=(0, 0, 0))
        # Draw a diagram box
        draw.rectangle([(100, 150), (450, 380)], outline=(0, 0, 0), width=4)
        draw.line([(100, 265), (450, 265)], fill=(0, 0, 0), width=3)
        draw.text((220, 240), "CIRCUIT DIAGRAM", fill=(0, 0, 0))

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        resp = await client.post(
            "/api/ocr/subject-process",
            files={"file": ("maths_paper.png", buf.getvalue(), "image/png")},
            data={"subject_type": "formula_maths", "languages": "eng"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["subject_type"] == "formula_maths"
        assert "Pix2Text" in data["engine_used"] or "Tesseract" in data["engine_used"]
        # Verify diagram was extracted
        assert data["total_diagrams"] >= 1
        assert len(data["diagrams"]) >= 1
        assert data["diagrams"][0]["image_url"].startswith("/static/diagrams/")
        assert data["diagrams"][0]["width"] > 0
        assert data["diagrams"][0]["height"] > 0


@pytest.mark.asyncio
async def test_subject_process_physics_and_chemistry():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        img_bytes = create_sample_image()
        # Physics test
        resp_phys = await client.post(
            "/api/ocr/subject-process",
            files={"file": ("physics.png", img_bytes, "image/png")},
            data={"subject_type": "physics", "languages": "eng"}
        )
        assert resp_phys.status_code == 200
        assert resp_phys.json()["subject_type"] == "physics"

        # Chemistry test
        resp_chem = await client.post(
            "/api/ocr/subject-process",
            files={"file": ("chemistry.png", img_bytes, "image/png")},
            data={"subject_type": "chemistry", "languages": "eng"}
        )
        assert resp_chem.status_code == 200
        assert resp_chem.json()["subject_type"] == "chemistry"


def test_ai_service_math_formula_and_diagram_rules():
    from app.ai_service import has_math_formula, contains_diagram_keyword, get_diagram_badge_title

    # 1. Formula detection
    assert has_math_formula("Find the limit of f(x) = $x^2 + 5$", []) is True
    assert has_math_formula("Evaluate $$\\int_0^1 x dx$$", []) is True
    assert has_math_formula("Where f(x) contains \\frac{a}{b}", []) is True
    assert has_math_formula(None, ["f(x) = x^2"]) is True
    assert has_math_formula("Plain text without formula", []) is False

    # 2. Diagram keywords: "graph", "plot", and "table" must NOT trigger diagram keyword
    assert contains_diagram_keyword("Sketch the graph of f(x)") is False
    assert contains_diagram_keyword("Plot the curve y = 2x") is False
    assert contains_diagram_keyword("The following table represents the estimated costs") is False
    assert contains_diagram_keyword("Consider the logic circuit L") is True
    assert contains_diagram_keyword("Refer to the figure below") is True
    assert contains_diagram_keyword("निम्न परिपथ में धारा ज्ञात कीजिए") is True

    # 3. Badge titles: Tables and Graph / Plot should NOT be returned as diagram badges
    assert get_diagram_badge_title("logic circuit with and gate") == "Circuit Diagram"
    assert get_diagram_badge_title("Fill the table with entries") != "Table Diagram"
    assert get_diagram_badge_title("plot the curve") != "Graph / Plot"


def test_page_aware_diagram_matching_and_continuation():
    from app.ai_service import find_question_page
    from app.schemas import DiagramItem

    page_texts = [
        "Question 1: Assignment problem machine M1 M2 M3 J1 J2 J3 minimize costs",
        "Question 2: Let n be a positive integer. Show that Z/nZ is an integral domain",
        "Question 5(c): निम्न तर्क परिपथ L का विचार कीजिए: (i) Y को बूलीय व्यंजक (ii) सत्यमान सारणी"
    ]

    # 1. find_question_page correctly maps questions
    assert find_question_page("Solve the assignment problem machine M1 M2", page_texts) == 1
    assert find_question_page("Z/nZ is an integral domain and field", page_texts) == 2
    assert find_question_page("निम्न तर्क परिपथ L का विचार कीजिए", page_texts) == 3

    # 2. Diagrams on Page 1 must NEVER map to Page 3 question
    diag_p1 = DiagramItem(id="d1", page_number=1, title="Diagram 1 (Page 1)", image_url="/static/diagrams/d1.png", width=400, height=300)
    diag_p3_a = DiagramItem(id="d3_a", page_number=3, title="Circuit Diagram", image_url="/static/diagrams/d3a.png", width=900, height=480)
    diag_p3_b = DiagramItem(id="d3_b", page_number=3, title="Circuit Diagram (Figure 2)", image_url="/static/diagrams/d3b.png", width=800, height=400)

    unassigned = [diag_p1, diag_p3_a, diag_p3_b]
    
    # Filter candidates on Page 3 for Q5(c)
    q5_page = find_question_page("निम्न तर्क परिपथ L का विचार कीजिए", page_texts)
    assert q5_page == 3

    page_3_candidates = [d for d in unassigned if d.page_number == q5_page]
    assert len(page_3_candidates) == 2
    assert diag_p1 not in page_3_candidates
    assert page_3_candidates[0].id == "d3_a"
    assert page_3_candidates[1].id == "d3_b"


