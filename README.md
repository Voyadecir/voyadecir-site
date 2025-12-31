# Voyadecir Frontend — Static Site

This repository contains the **static frontend** for Voyadecir.

It is intentionally simple and logic-light.

---

## What This Repo Is

- Static HTML / CSS / JavaScript
- Hosted on Render as a Static Site
- Serves the unified Voyadecir web experience
- Calls backend APIs for all intelligence

This repo does **not** perform:
- OCR
- translation
- document parsing
- explanations
- AI reasoning

---

## Architecture Rules (Non-Negotiable)

- ❌ No secrets or API keys in frontend code
- ❌ No client-side LLMs
- ❌ No OCR logic
- ❌ No backend business logic

All intelligence lives in the backend.

---

## Backend Dependency

This frontend depends on the **ai-translator** backend for:

- `/api/translate`
- `/api/mailbills/parse`

If something “smart” is happening, it should not be happening here.

---

## Language Behavior

- EN / ES auto-detection is required
- Manual language toggle must always be available
- UI must not auto-switch languages without user intent

---

## Deployment

- Push to `main`
- Render auto-deploys
- No build step
- Root directory is published as-is

---

## Source of Truth

Authoritative rules live in the **meta repo**:

- Architecture: `voyadecir-meta/README.md`
- AI behavior: `voyadecir-meta/AGENTS.md`
- Priorities: `voyadecir-meta/TASKS.md`

If this README conflicts with those, **those win**.
