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
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com")
      .replace(/\/$/, "");
  const API_URL = `${AI_TRANSLATOR_BASE}/api/translate`;

  const $ = (sel) => document.querySelector(sel);

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
      setStatus("Type something to translate.");
      return;
    }

    setStatus("Translating…");
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
        setStatus("Could not reach translator server. Showing backup.");
        if (tgtEl) tgtEl.value = `[${target_lang}] ${text}`;
        return;
      }

      const out =
        data.translated_text || data.translation || `[${target_lang}] ${text}`;
      if (tgtEl) tgtEl.value = out;
      setStatus("Done.");

      // Future: display warnings/enrichment details here when UI supports it
    } catch (err) {
      console.error("Network error", err);
      setStatus("Network error. Showing backup.");
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
        setStatus("Ready");
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
  }

  window.addEventListener("DOMContentLoaded", init);
})();
