import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets/i18n/master.json"
OUT_DIR = ROOT / "assets/i18n"

LANGS = ["en", "es", "pt", "fr", "zh", "hi", "ar", "bn", "ru", "ur"]

ES_OVERRIDES = {
    "nav.home": "Inicio",
    "nav.translate": "Traducir",
    "nav.mail": "Correo y Facturas",
    "nav.more": "Más",
    "nav.about": "Acerca de",
    "nav.contact": "Contacto",
    "nav.privacy": "Privacidad",
    "nav.terms": "Términos",
    "site.disclaimer": "Aviso: Voyadecir es solo para traducción informativa y no cumple con HIPAA ni FERPA. No subas información médica o estudiantil confidencial. No es asesoría legal, médica ni financiera.",
    "mb.title": "Asistente de Correo y Facturas",
    "mb.subtitle": "Sube una foto o PDF de tu factura, carta o documento.",
    "mb.upload": "Subir documento",
    "mb.camera": "Tomar foto",
    "mb.translate": "Traducir",
    "mb.clear": "Limpiar",
    "mb.to": "A",
    "mb.copy.text": "Copiar texto",
    "mb.copy.summary": "Copiar resumen",
    "mb.download": "Descargar PDF",
    "mb.status.ready": "Listo",
    "mb.status.reading": "Leyendo documento…",
    "mb.status.ocr": "Ejecutando OCR…",
    "mb.status.interpreting": "Explicando y traduciendo…",
    "mb.status.done": "Listo",
    "mb.status.error": "Ocurrió un problema",
    "mb.status.no_text": "No hay texto para exportar todavía.",
    "mb.status.building_pdf": "Creando PDF…",
    "mb.status.needs_upload": "Primero sube un documento.",
    "mb.clarifications": "Encontramos posibles ambigüedades. Aclara por favor:",
    "translate.title": "Traducir",
    "translate.subtitle": "Pega texto para traducir. Voyadecir traduce con contexto y puede mostrar varios significados.",
    "translate.button.translate": "Traducir",
    "translate.button.clear": "Limpiar",
    "translate.button.paste": "Pegar",
    "translate.button.copy": "Copiar",
    "translate.to": "A",
    "translate.src.placeholder": "Escribe texto para traducir…",
    "translate.out.placeholder": "La traducción aparecerá aquí…",
    "translate.status.ready": "Listo",
    "translate.status.detecting": "Detectando idioma…",
    "translate.status.translating": "Traduciendo…",
    "translate.status.done": "Listo.",
    "translate.status.network_error": "Error de red. Mostrando copia provisional.",
    "translate.status.server_error": "No pudimos contactar al traductor. Mostrando copia provisional.",
    "translate.status.need_text": "Escribe algo para traducir.",
    "translate.status.ambiguous": "Detectamos varios significados. Aclara por favor.",
    "translate.hint": "Para mejores resultados, agrega contexto (quién/qué/dónde).",
    "assistant.title": "Clara, tu Asistente",
    "assistant.placeholder": "Pregúntame sobre Voyadecir…",
    "assistant.thinking": "Pensando…",
    "assistant.error": "Algo salió mal. Intenta de nuevo.",
    "assistant.scope": "Puedo responder algunas preguntas, pero soy mejor con preguntas de Voyadecir (web y futuras apps).",
    "assistant.hello": "Hola, soy Clara. Puedo explicar cómo funciona Voyadecir o ayudarte con tus traducciones.",
    "assistant.bugPrompt": "Si es un bug, cuéntame qué pasó (qué subiste, qué esperabas y qué viste). Puedo registrarlo para soporte.",
    "assistant.logged": "Listo. Registré una solicitud de soporte. También puedes usar la página de Contacto.",
    "assistant.clarify": "Veo posibles ambigüedades. Dame más detalles para responder bien."
}

LANG_OVERRIDES = {"es": ES_OVERRIDES}


def main():
    master = json.loads(MASTER.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for lang in LANGS:
        payload = master.copy()
        overrides = LANG_OVERRIDES.get(lang, {})
        payload.update(overrides)

        out_path = OUT_DIR / f"{lang}.json"
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {out_path.relative_to(ROOT)}")
if __name__ == "__main__":
    main()
