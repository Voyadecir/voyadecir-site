// assets/js/translate.js  (v10)
(function () {
  const API_URL = "https://ai-translator-i5jb.onrender.com/api/translate";

  const $ = (s) => document.querySelector(s);

  // Elements
  let form, srcBox, tgtBox, srcSel, tgtSel, swapBtn, submitBtn, hintEl;

  function init() {
    form = $("#translator-form");
    srcBox = $("#src-text");
    tgtBox = $("#tgt-text");
    srcSel = $("#src-lang");
    tgtSel = $("#tgt-lang");
    swapBtn = $("#swap-langs");
    submitBtn = $("#do-translate");
    hintEl = $("#translator-hint");

    if (!form) return;

    // Kill default submit navigation
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      doTranslate();
      return false;
    });

    // Ensure “Translate” button doesn’t submit the page
    if (submitBtn) {
      submitBtn.addEventListener("click", function (e) {
        e.preventDefault();
        doTranslate();
      });
    }

    // Swap languages (and move text if present)
    if (swapBtn) {
      swapBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const srcVal = srcSel.value;
        const tgtVal = tgtSel.value;
        srcSel.value = tgtVal;
        tgtSel.value = srcVal;

        // swap text content for convenience
        const a = srcBox.value;
        srcBox.value = tgtBox.value || "";
        tgtBox.value = a || "";
      });
    }
  }

  async function doTranslate() {
    const text = (srcBox.value || "").trim();
    const target_lang = (tgtSel.value || "es").trim();

    if (!text) {
      setHint("Type something to translate.");
      return;
    }

    setHint("Translating…");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang }),
      });

      if (!res.ok) {
        // Server error → show helpful fallback
        const err = await safeJson(res);
        setHint("Could not reach translator server. Showing backup.");
        tgtBox.value = `[${target_lang}] ${text}`;
        console.error("Translate error", res.status, err);
        return;
      }

      const data = await res.json();
      const out = data.translated_text || data.translation || "";
      if (!out) {
        setHint("Empty response. Showing backup.");
        tgtBox.value = `[${target_lang}] ${text}`;
        return;
      }

      tgtBox.value = out;
      setHint("Done.");
    } catch (e) {
      setHint("Network error. Showing backup.");
      tgtBox.value = `[${target_lang}] ${text}`;
      console.error("Network error", e);
    }
  }

  function setHint(msg) {
    if (hintEl) hintEl.textContent = msg;
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return { raw: await res.text() };
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
