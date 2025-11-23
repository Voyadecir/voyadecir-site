# OCR_DEBUG.md — Azure-Primary OCR + Full Redundancy

## Goal
Fix the current Bills/Mail OCR failure and make OCR resilient.
Primary OCR engine: **Azure Document Intelligence Read OCR**.
Backup OCR engine: local Tesseract (or other open OCR) only on Azure failure/low confidence. :contentReference[oaicite:3]{index=3}  

## Current Symptom
Frontend shows:
> “Server error. Please check Azure Function logs, key/endpoints, and CORS.”

Azure Function logs at failure:
- CORS preflight succeeds.
- Route matches `api/mailbills/parse`.
- Function executes and **fails in ~77ms**.
- Later appears host drain/restart.
Interpretation: failure is inside function startup/logic (env vars, auth, parsing, missing deps), not CORS. :contentReference[oaicite:4]{index=4}  

## Debug Strategy (must implement)
### 1. Add /api/ocr-debug endpoint (FastAPI OR Azure Function mirror)
Endpoint accepts image/PDF upload and returns:
- stage-by-stage status
- preprocessing artifacts (temp images)
- raw OCR text (Azure + fallback)
- confidence scores
- which engine was used (azure_primary / fallback)

Return JSON like:
```json
{
  "engine_used": "azure_primary",
  "stages": {
    "upload_parse": "ok",
    "pdf_to_image": {"status":"ok","dpi":300},
    "preprocess": "ok",
    "azure_read_call": "ok",
    "fallback_call": "skipped"
  },
  "confidence": 0.91,
  "text_preview": "..."
}
