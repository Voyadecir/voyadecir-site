// assets/js/translate.js  (v10)
(function () {
  // your FastAPI JSON endpoint
  const API_URL = "https://ai-translator-i5jb.onrender.com/api/translate";

  const $ = s => document.querySelector(s);

  // elements on translate.html
  const srcBox   = $("#source-text");
  const tgtBox   = $("#target-text");
  const srcSel   = $("#src-lang");
  const tgtSel   = $("#tgt-lang");
  const swapBtn  = $("#swap-langs");
  const runBtn   = $("#translate-run");
  const statusEl = $("#translator-status");
  const iframeFB = $("#iframe-fallback"); // fallback panel (hidden by default)

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function showFallbackIframe(show) {
    if (!iframeFB) return;
    iframeFB.style.display = show ? "block" : "none";
  }

  async function doTranslate() {
    const text = (srcBox?.value || "").trim();
    const target_lang = (tgtSel?.value || "es").trim();

    if (!text) {
      setStatus("Type something to translate.");
      return;
    }

    setStatus("Translating…");
    showFallbackIframe(false); // hide fallback unless we actually fail

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang })
      });

      if (!res.ok) {
        // server said nope — show graceful fallback
        let body;
        try { body = await res.json(); } catch { body = await res.text(); }
        console.error("Translator error", res.status, body);
        setStatus("Could not reach translator server. Showing backup.");
        if (tgtBox) tgtBox.value = `[${target_lang}] ${text}`;
        // if it’s CORS or blocked, show the iframe escape hatch
        showFallbackIframe(true);
        return;
      }

      const data = await res.json();
      const out = data.translated_text || data.translation || "";
      if (!out) {
        setStatus("Empty response. Showing backup.");
        if (tgtBox) tgtBox.value = `[${target_lang}] ${text}`;
        return;
      }

      if (tgtBox) tgtBox.value = out;
      setStatus("Done.");

// Show enrichment / warnings (human interpreter feel)
try {
  const details = document.getElementById("translate-details");
  const warnEl = document.getElementById("translate-warnings");
  const enrichEl = document.getElementById("translate-enrichment");

  const warnings = data.warnings || [];
  const enrichment = data.enrichment || {};

  let hasAny = false;

  if (warnEl) {
    warnEl.innerHTML = "";
    if (Array.isArray(warnings) && warnings.length) {
      hasAny = true;
      const h = document.createElement("h3");
      h.textContent = (typeof window.voyT==="function" ? window.voyT("translate.warnings","Warnings") : "Warnings");
      warnEl.appendChild(h);
      const ul = document.createElement("ul");
      warnings.forEach(w => {
        const li = document.createElement("li");
        li.textContent = typeof w === "string" ? w : JSON.stringify(w);
        ul.appendChild(li);
      });
      warnEl.appendChild(ul);
    }
  }

  if (enrichEl) {
    enrichEl.innerHTML = "";
    const ambiguous = enrichment.ambiguous_words || enrichment.ambiguous || [];
    const meanings = enrichment.meanings || null;
    if ((Array.isArray(ambiguous) && ambiguous.length) || meanings) {
      hasAny = true;
      const h2 = document.createElement("h3");
      h2.textContent = (typeof window.voyT==="function" ? window.voyT("translate.alternatives","Alternatives & meanings") : "Alternatives & meanings");
      enrichEl.appendChild(h2);

      if (Array.isArray(ambiguous) && ambiguous.length) {
        ambiguous.forEach(item => {
          const div = document.createElement("div");
          const word = item.word || "";
          div.innerHTML = `<strong>${word}</strong>`;
          const ul = document.createElement("ul");
          (item.meanings || []).forEach(m => {
            const li = document.createElement("li");
            li.textContent = m;
            ul.appendChild(li);
          });
          div.appendChild(ul);
          enrichEl.appendChild(div);
        });
      }
    }
  }

  if (details) {
    details.hidden = !hasAny;
  }
} catch (e) {}
    } catch (err) {
      console.error("Network error", err);
      setStatus("Network error. Showing backup.");
      if (tgtBox) tgtBox.value = `[${target_lang}] ${text}`;
      showFallbackIframe(true);
    }
  }

  // wire up controls
  function init() {
    // Translate button in the top row
    if (runBtn) {
      runBtn.addEventListener("click", function (e) {
        e.preventDefault();   // make absolutely sure it never navigates
        doTranslate();
      });
    }

    // Swap languages (and swap text for convenience)
    if (swapBtn && srcSel && tgtSel) {
      swapBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const a = srcSel.value;
        srcSel.value = tgtSel.value;
        tgtSel.value = a;

        if (srcBox && tgtBox) {
          const t = srcBox.value;
          srcBox.value = tgtBox.value || "";
          tgtBox.value = t || "";
        }
      });
    }

    // Safety: stop Enter key from doing a page navigation if someone presses it
    if (srcBox) {
      srcBox.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          // allow Ctrl/Cmd+Enter to translate
          e.preventDefault();
          doTranslate();
        }
      });
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
