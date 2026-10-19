import os
import boto3
from botocore.config import Config
from typing import Optional

# Utho Cloud Object Storage Config
UTHO_ENDPOINT = os.getenv("UTHO_ENDPOINT", "https://innoida.utho.io").rstrip("/")
UTHO_ZONE = os.getenv("UTHO_ZONE", "ap-south-in-noida-1")
UTHO_KEY = os.getenv("UTHO_KEY") or os.getenv("AWS_ACCESS_KEY_ID", "")
UTHO_SECRET = os.getenv("UTHO_SECRET") or os.getenv("AWS_SECRET_ACCESS_KEY", "")
UTHO_BUCKET = os.getenv("UTHO_BUCKET") or os.getenv("AWS_BUCKET_NAME", "yukit-prep")

_s3_client = None


def get_s3_client():
    global _s3_client
    if _s3_client is None and UTHO_KEY and UTHO_SECRET:
        _s3_client = boto3.client(
            "s3",
            endpoint_url=UTHO_ENDPOINT,
            region_name=UTHO_ZONE,
            aws_access_key_id=UTHO_KEY,
            aws_secret_access_key=UTHO_SECRET,
            config=Config(s3={"addressing_style": "path"}, signature_version="s3v4"),
        )
    return _s3_client


def upload_image_to_utho(
    file_bytes: bytes,
    filename: str,
    content_type: str = "image/png",
    folder: str = "ocr-diagrams",
) -> Optional[str]:
    """
    Uploads raw image bytes to Utho Object Storage and returns the public URL.
    Returns None if Utho credentials are not configured or upload fails.
    """
    client = get_s3_client()
    if not client or not UTHO_BUCKET:
        return None

    key = f"{folder}/{filename}"
    try:
        client.put_object(
            Bucket=UTHO_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        # Format URL according to Utho path-style spec: https://innoida.utho.io/<bucket>/<key>
        return f"{UTHO_ENDPOINT}/{UTHO_BUCKET}/{key}"
    except Exception as e:
        print(f"[UthoStorage] Failed to upload {filename} to Utho: {e}")
        return None
