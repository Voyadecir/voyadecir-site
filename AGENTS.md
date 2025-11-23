# AGENTS.md — Voyadecir

## Project goal
Build Voyadecir into a bilingual translation + Bills/Mail Helper product targeting $6k MRR.

## Tech stack
- Backend: FastAPI (Render, Docker)
- Frontend: static HTML/CSS/JS (Render static)
- OCR: tesseract-ocr, poppler-utils, imagemagick
- LLM: Azure OpenAI via env vars

## Setup (cloud task)
1. pip install -r requirements.txt
2. apt-get update && apt-get install -y tesseract-ocr poppler-utils imagemagick
3. export ENV vars (see below)
4. pytest (if tests exist)
5. uvicorn ai_translator.api:app --reload

## Env vars
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=
OFFLINE_MODE=false

## Run commands
- API: uvicorn ai_translator.api:app --host 0.0.0.0 --port 8000
- Tests: pytest -q

## Style rules
- Keep minimalist black/white Voyadecir UI.
- Don’t add trackers without asking.
- Preserve EN/ES autodetect + toggle.

## Files to be careful with
- dockerfile (required)
- requirements.txt (no missing deps)
