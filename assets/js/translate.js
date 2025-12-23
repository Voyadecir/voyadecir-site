/* Modernized translate.js for Voyadecir.
 * This script wires up the translation UI on translate.html.  It uses the same
 * configuration patterns as mailbills.js: picks the API base from
 * window.VOY_AI_TRANSLATOR_BASE if defined and falls back to the Render
 * deployment.  It also respects the user's UI language stored in
 * sessionStorage under the "voyadecir_lang" key.  The script binds buttons
 * for translating, clearing, pasting from the clipboard and copying text.
 */
(function () {
  "use strict";

  // Determine API base URL from global or fallback
  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || window.location.origin || "")
      .replace(/\/$/, "");
  const API_URL = `${AI_TRANSLATOR_BASE}/api/translate`;

  const $ = (sel) => document.querySelector(sel);

  const t = (key, fallback = "") => {
    if (window.VOY_I18N?.t) return window.VOY_I18N.t(key, fallback);
    return fallback || key;
  };

  /** Return the user's preferred UI language from sessionStorage. */
  function uiLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  /** Update the status line on the page. */
  function setStatus(msg) {
    const el = $("#t-status");
    if (el) el.textContent = msg;
  }

  /** Perform the translation call and update the UI with the result. */
  async function doTranslate() {
    const srcEl = $("#src-text");
    const tgtEl = $("#out-text");
    const langEl = $("#tgt-lang");
    const text = (srcEl?.value || "").trim();
    const target_lang = (langEl?.value || "es").trim();

    if (!text) {
      setStatus(t("translate.status.need_text", "Type something to translate."));
      return;
    }

    setStatus(t("translate.status.detecting", "Detecting language…"));
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          target_lang,
          source_lang: "auto",
          ui_lang: uiLang(),
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        // ignore JSON parse failure; will fallback
      }

      if (!res.ok) {
        console.error("Translator error", res.status, data);
        setStatus(
          t(
            "translate.status.server_error",
            "Could not reach translator server. Showing backup."
          )
        );
        if (tgtEl) tgtEl.value = `[${target_lang}] ${text}`;
        return;
      }

      const out =
        data.translated_text || data.translation || `[${target_lang}] ${text}`;
      if (tgtEl) tgtEl.value = out;
      const detected = data.detected_source_lang || data.source_lang;
      if (data.enrichment?.ambiguous_words?.length || text.split(/\s+/).length === 1) {
        const words = (data.enrichment?.ambiguous_words || []).join(", ") || detected || "?";
        setStatus(
          `${t(
            "translate.status.ambiguous",
            "Multiple meanings detected. Please clarify."
          )} (${words})`
        );
      } else {
        setStatus(t("translate.status.done", "Done."));
      }

      // Future: display warnings/enrichment details here when UI supports it
    } catch (err) {
      console.error("Network error", err);
      setStatus(t("translate.status.network_error", "Network error. Showing backup."));
      if (tgtEl) tgtEl.value = `[${target_lang}] ${text}`;
    }
  }

  /** Bind UI event handlers once the DOM is loaded. */
  function init() {
    const btnTranslate = $("#btn-translate");
    const btnClear = $("#btn-clear");
    const btnPaste = $("#btn-paste");
    const btnCopySrc = $("#btn-copy-src");
    const btnCopyOut = $("#btn-copy-out");

    if (btnTranslate) {
      btnTranslate.addEventListener("click", (e) => {
        e.preventDefault();
        doTranslate();
      });
    }

    if (btnClear) {
      btnClear.addEventListener("click", (e) => {
        e.preventDefault();
        const src = $("#src-text");
        const tgt = $("#out-text");
        if (src) src.value = "";
        if (tgt) tgt.value = "";
        setStatus(t("translate.status.ready", "Ready"));
      });
    }

    if (btnPaste) {
      btnPaste.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const text = await navigator.clipboard.readText();
          const src = $("#src-text");
          if (src) src.value = text;
        } catch (_) {
          // ignore clipboard errors
        }
      });
    }

    if (btnCopySrc) {
      btnCopySrc.addEventListener("click", (e) => {
        e.preventDefault();
        const text = $("#src-text")?.value || "";
        if (text) navigator.clipboard?.writeText(text).catch(() => {});
      });
    }

    if (btnCopyOut) {
      btnCopyOut.addEventListener("click", (e) => {
        e.preventDefault();
        const text = $("#out-text")?.value || "";
        if (text) navigator.clipboard?.writeText(text).catch(() => {});
      });
    }

    const outBox = $("#out-text");
    if (outBox) {
      outBox.setAttribute(
        "placeholder",
        t("translate.out.placeholder", "Translation will appear here…")
      );
    }

    const srcBox = $("#src-text");
    if (srcBox) {
      srcBox.setAttribute(
        "placeholder",
        t("translate.src.placeholder", "Enter text to translate…")
      );
    }

    setStatus(t("translate.status.ready", "Ready"));
  }

  window.addEventListener("DOMContentLoaded", init);
  window.addEventListener("voyadecir:lang-change", () => {
    setStatus(t("translate.status.ready", "Ready"));
  });
})();
