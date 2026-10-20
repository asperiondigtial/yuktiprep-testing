FROM python:3.12-slim

# Python runtime settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install OS dependencies for PDF + OCR
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-hin \
        tesseract-ocr-tam \
        tesseract-ocr-tel \
        tesseract-ocr-kan \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create a dedicated non-root user
RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid appgroup --create-home appuser

WORKDIR /app

# Install dependencies first for caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and fix ownership
COPY --chown=appuser:appgroup . .

# Tesseract data location
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

# Ensure the app directory is writable for the runtime user
RUN chown -R appuser:appgroup /app

EXPOSE 8000

# Run as non-root
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Start the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
