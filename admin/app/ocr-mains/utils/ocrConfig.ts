export function getOcrApiUrl(): string {
  if (process.env.NEXT_PUBLIC_OCR_API_URL) {
    return process.env.NEXT_PUBLIC_OCR_API_URL;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.includes("yuktiprep.com")) {
      return "https://ba.yuktiprep.com/ocr";
    }
  }
  return "http://localhost:8000";
}
