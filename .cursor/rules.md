# Voyadecir Cursor Rules (Authoritative)

## Golden rules
- This workspace is a META repo that orchestrates multiple repos via git submodules.
- Do NOT restructure repos or suggest merging/splitting repos unless the user explicitly says: “change the architecture.”
- Do NOT move code across repos. Make changes in-place in the correct repo.

## Repo boundaries
- voyadecir-site: static website (HTML/CSS/JS). UI fixes, language toggle, layout.
- ai-translator: FastAPI backend + deep-agent endpoints. Business logic, translation, explanations.
- azure-funcs-voyadecir: Azure Functions for OCR. Document Intelligence Read integration, polling/retries.

## Change style
- Prefer small, surgical edits. Avoid sweeping refactors.
- Always explain what files you will change before changing them.
- Return full updated files only when changes are large; otherwise provide minimal diffs.

## Reliability over features
- Prioritize OCR reliability and the known active bugs before adding new features.
- When uncertain, add logging and diagnostics rather than guessing.

## Safety and claims
- Do not add compliance claims (HIPAA/FERPA). Keep the existing disclaimer wording.
- Do not introduce client-side LLM processing of documents.

## Submodules workflow
- Changes are committed and PR’d in the *submodule repos*.
- The meta repo only updates submodule pointers after submodule PRs are merged.
