// Mail & Bills — client → OCR (Azure Functions) + Deep Agent (ai-translator)
// Fixes:
// - Upload Document / Take Picture always respond (desktop + iOS/iPadOS)
// - Uses the correct element IDs from mail-bills.html
// - Auto-runs OCR → interpret (no dead-end “Translate Full Text” behavior)
// - Keeps UI exactly the same (just wiring + correctness)

(() => {
  "use strict";

  // ===== Config (keep your existing services) =====
  const AZURE_FUNCS_BASE =
    (window.VOY_AZURE_FUNCS_BASE ||
      "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net"
    ).replace(/\/$/, "");

  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com"
    ).replace(/\/$/, "");

  const URL_PARSE = `${AZURE_FUNCS_BASE}/api/mailbills/parse`;
  const URL_INTERPRET = `${AI_TRANSLATOR_BASE}/api/mailbills/interpret`;
  const URL_TRANSLATE_PDF = `${AI_TRANSLATOR_BASE}/api/mailbills/translate-pdf`;

  // ===== Helpers =====
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  function getUiLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  function setStatus(msg) {
    const el = $("#status-line");
    if (el) el.textContent = msg;
  }

  function setBusy(isBusy) {
    ["#btn-upload", "#btn-camera", "#mb-translate-btn", "#mb-clear", "#mb-download-pdf"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!isBusy;
    });
  }

  function enablePdfButton(enabled) {
    const b = $("#mb-download-pdf");
    if (b) b.disabled = !enabled;
  }

  function getTargetLangEl() {
    // New HTML uses #target-lang. Old versions used #mb-tgt-lang.
    return $("#target-lang") || $("#mb-tgt-lang");
  }

  function getSwapBtnEl() {
    // New HTML uses #swap-btn. Old versions used #mb-swap-langs.
    return $("#swap-btn") || $("#mb-swap-langs");
  }

  function getFileInputEl() {
    return $("#file-input");
  }

  function getCameraInputEl() {
    return $("#camera-input");
  }

  function getOcrBox() {
    return $("#ocr-text");
  }

  function getSummaryBox() {
    return $("#summary-text");
  }

  function fileContentType(file) {
    const name = (file?.name || "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".tif") || name.endsWith(".tiff")) return "image/tiff";
    return file?.type || "application/octet-stream";
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    let bodyText = "";
    try { bodyText = await res.text(); } catch (_) {}
    let json = null;
    try { json = bodyText ? JSON.parse(bodyText) : null; } catch (_) { json = null; }
    return { ok: res.ok, status: res.status, json, bodyText };
  }

  async function parseWithAzure(file) {
    const bytes = await file.arrayBuffer();
    const ct = fileContentType(file);

    const out = await fetchJson(URL_PARSE, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        "X-Voyadecir-Lang": getUiLang(),
      },
      body: bytes,
    });

    if (!out.ok) {
      const msg =
        out.json?.message ||
        out.json?.error ||
        out.json?.body_preview ||
        out.bodyText ||
        `Analyze call failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

    const j = out.json || {};
    const text =
      j.text ||
      j.ocr_text ||
      j.result?.text ||
      j.result?.ocr_text ||
      "";

    if (!String(text || "").trim()) {
      throw new Error("OCR returned no text. Try a clearer photo or PDF.");
    }

    return String(text);
  }

  async function interpretWithAgent(ocrText, targetLang) {
    const out = await fetchJson(URL_INTERPRET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: ocrText,
        target_lang: targetLang,
        ui_lang: getUiLang(),
      }),
    });

    if (!out.ok) {
      const msg =
        out.json?.detail ||
        out.json?.message ||
        out.json?.error ||
        out.bodyText ||
        `Interpret failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

    return out.json || {};
  }

  function renderInterpretation(data) {
    const summaryBox = getSummaryBox();
    if (summaryBox) {
      const summary =
        data.summary ||
        data.explanation ||
        data.message ||
        data.result?.summary ||
        data.result?.explanation ||
        "";
      summaryBox.value = String(summary || "");
    }

    const setList = (sectionId, listId, items) => {
      const sec = document.getElementById(sectionId);
      const ul = document.getElementById(listId);
      if (!sec || !ul) return;
      ul.innerHTML = "";
      if (!Array.isArray(items) || items.length === 0) {
        sec.style.display = "none";
        return;
      }
      items.forEach((it) => {
        const li = document.createElement("li");
        li.textContent = String(it);
        ul.appendChild(li);
      });
      sec.style.display = "block";
    };

    setList("identity-section", "identity-list", data.identity_items || data.identity || []);
    setList("payment-section", "payment-list", data.payment_items || data.payment || []);
    setList("other-amounts-section", "other-amounts-list", data.other_amounts_items || data.other_amounts || []);
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setBusy(true);
    enablePdfButton(false);
    setStatus("Reading document…");

    try {
      const file = files[0];

      setStatus("Running OCR…");
      const ocrText = await parseWithAzure(file);

      const ocrBox = getOcrBox();
      if (ocrBox) ocrBox.value = ocrText;

      const tgt = getTargetLangEl();
      const targetLang = tgt ? tgt.value : "es";

      setStatus("Explaining and translating…");
      const interpretation = await interpretWithAgent(ocrText, targetLang);

      renderInterpretation(interpretation);
      enablePdfButton(true);
      setStatus("Done");
    } catch (err) {
      setStatus(err?.message ? err.message : String(err));
    } finally {
      setBusy(false);
      const fi = getFileInputEl();
      const ci = getCameraInputEl();
      if (fi) fi.value = "";
      if (ci) ci.value = "";
    }
  }

  async function downloadTranslatedPdf() {
    const ocrText = getOcrBox()?.value || "";
    const summary = getSummaryBox()?.value || "";
    const targetLang = getTargetLangEl()?.value || "es";

    if (!ocrText.trim()) {
      setStatus("No text to export yet.");
      return;
    }

    setBusy(true);
    setStatus("Building PDF…");

    try {
      const res = await fetch(URL_TRANSLATE_PDF, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ocrText,
          summary,
          target_lang: targetLang,
          ui_lang: getUiLang(),
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `PDF export failed with HTTP ${res.status}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "voyadecir-translation.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Downloaded");
    } catch (err) {
      setStatus(err?.message ? err.message : "PDF export failed.");
    } finally {
      setBusy(false);
    }
  }

  function copyToClipboard(text) {
    const v = String(text || "");
    if (!v) return;
    navigator.clipboard?.writeText(v).catch(() => {});
  }

  function wire() {
    const btnUpload = $("#btn-upload");
    const btnCamera = $("#btn-camera");
    const btnClear = $("#mb-clear");
    const btnTranslate = $("#mb-translate-btn");
    const btnPdf = $("#mb-download-pdf");

    const fileInput = getFileInputEl();
    const camInput = getCameraInputEl();

    const clickFile = () => fileInput && fileInput.click();
    const clickCam = () => camInput && camInput.click();

    // iPad needs touchstart to reliably open file/camera pickers
    on(btnUpload, "click", clickFile);
    on(btnUpload, "touchstart", (e) => { e.preventDefault(); clickFile(); }, { passive: false });

    on(btnCamera, "click", clickCam);
    on(btnCamera, "touchstart", (e) => { e.preventDefault(); clickCam(); }, { passive: false });

    on(fileInput, "change", (e) => handleFiles(e.target.files));
    on(camInput, "change", (e) => handleFiles(e.target.files));

    // Manual rerun (UI keeps the button, but OCR upload auto-runs anyway)
    on(btnTranslate, "click", async () => {
      const ocrBox = getOcrBox();
      if (!ocrBox || !ocrBox.value.trim()) {
        setStatus("Upload a document first.");
        return;
      }
      setBusy(true);
      enablePdfButton(false);
      setStatus("Explaining and translating…");
      try {
        const interpretation = await interpretWithAgent(
          ocrBox.value,
          getTargetLangEl()?.value || "es"
        );
        renderInterpretation(interpretation);
        enablePdfButton(true);
        setStatus("Done");
      } catch (err) {
        setStatus(err?.message ? err.message : "Interpret failed.");
      } finally {
        setBusy(false);
      }
    });

    on(btnClear, "click", () => {
      if (getOcrBox()) getOcrBox().value = "";
      if (getSummaryBox()) getSummaryBox().value = "";
      enablePdfButton(false);
      setStatus("Ready");
      ["identity-section", "payment-section", "other-amounts-section"].forEach((id) => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = "none";
      });
    });

    on($("#mb-copy-text") || $("#mb-copy-ocr"), "click", () => copyToClipboard(getOcrBox()?.value || ""));
    on($("#mb-copy-summary"), "click", () => copyToClipboard(getSummaryBox()?.value || ""));
    on(btnPdf, "click", downloadTranslatedPdf);

    // Swap (optional)
    on(getSwapBtnEl(), "click", () => {
      const tgt = getTargetLangEl();
      if (!tgt) return;
      tgt.value = (tgt.value === "en") ? "es" : "en";
    });

    enablePdfButton(false);
    setStatus("Ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
