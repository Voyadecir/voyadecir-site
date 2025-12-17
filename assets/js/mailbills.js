/* Voyadecir — Mail & Bills Helper (frontend)
   Robust wiring for buttons/IDs across layout revisions.
*/
(function () {
  "use strict";

  const OCR_API_BASE =
    window.OCR_API_BASE ||
    "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

  const BACKEND_BASE =
    window.AGENT_API_BASE ||
    window.INTERPRET_API_BASE ||
    "https://ai-translator-i5jb.onrender.com";

  const OCR_PARSE_API = `${OCR_API_BASE}/api/mailbills/parse`;
  const INTERPRET_API = `${BACKEND_BASE}/api/mailbills/interpret`;

  // PDF export: try new, then old
  const PDF_API_PRIMARY = `${BACKEND_BASE}/api/mailbills/translate-pdf`;
  const PDF_API_FALLBACK = `${BACKEND_BASE}/api/mailbills/pdf`;

  const $ = (sel) => document.querySelector(sel);

  function firstExisting(selectors) {
    for (const s of selectors) {
      const el = $(s);
      if (el) return el;
    }
    return null;
  }

  // ---- Find elements (supports multiple versions of your HTML) ----
  const elUploadBtn = firstExisting(["#btn-upload", "#mb-upload-btn", "#upload-btn"]);
  const elCameraBtn = firstExisting(["#btn-camera", "#mb-photo-btn", "#camera-btn"]);
  const elMoreBtn = firstExisting(["#nav-more", ".nav-more-btn", "[data-nav-more]"]); // harmless if absent

  const elFileInput = firstExisting(["#file-input", "#mb-file", "#upload-input", "input[type=file]#file"]);
  const elCameraInput = firstExisting(["#camera-input", "#mb-camera", "#camera-input-file"]);

  const elClearBtn = firstExisting(["#mb-clear", "#mb-clear-btn", "#clear-btn"]);
  const elDownloadBtn = firstExisting(["#mb-download-pdf", "#download-pdf", "#mb-download"]);

  const elOcrText = firstExisting(["#ocr-text", "#mb-ocr-text", "#mb-ocrText"]);
  const elSummaryText = firstExisting(["#summary-text", "#mb-summary", "#mb-summaryText"]);

  const elStatus = firstExisting(["#status-line", "#mb-status", "#status"]);
  const elError = firstExisting(["#mb-error", "#error-line", "#error"]);

  const elTargetLang = firstExisting(["#mb-tgt-lang", "#target-lang", "#toLang"]);

  // If an old “Translate Full Text” button exists, hide it (you want auto-run)
  const elTranslateBtn = firstExisting(["#mb-translate-btn", "#translate-full", "#btn-translate-full"]);
  if (elTranslateBtn) elTranslateBtn.style.display = "none";

  // ---- UI helpers ----
  function setStatus(msg) {
    if (elStatus) elStatus.textContent = msg || "";
  }
  function setError(msg) {
    if (!elError) return;
    elError.textContent = msg || "";
    elError.style.display = msg ? "block" : "none";
  }
  function setDisabled(btn, disabled) {
    if (!btn) return;
    btn.disabled = !!disabled;
    btn.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function guessContentType(file) {
    let ct = (file && file.type) || "application/octet-stream";
    if (ct && ct !== "application/octet-stream") return ct;

    const name = (file && file.name ? String(file.name) : "").toLowerCase();
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";

    return "application/octet-stream";
  }

  async function ocrParse(file) {
    const buf = await file.arrayBuffer();
    const ct = guessContentType(file);

    const headers = { "Content-Type": ct };
    try {
      if (file?.name) headers["x-filename"] = file.name;
    } catch (_) {}

    const res = await fetch(OCR_PARSE_API, {
      method: "POST",
      headers,
      body: buf,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      const msg = data?.message || `OCR failed (${res.status}).`;
      throw new Error(msg);
    }
    return data;
  }

  async function interpretText(ocrText) {
    const target_lang = (elTargetLang?.value || "").trim() || "es";

    const payload = {
      ocr_text: ocrText,
      target_lang,
      source_hint: "auto",
    };

    const res = await fetch(INTERPRET_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const msg = data?.message || `Analyze failed (${res.status}).`;
      throw new Error(msg);
    }
    return data;
  }

  async function exportPdf(last) {
    const payload = {
      ocr_text: last.ocr_text,
      summary: last.summary || "",
      target_lang: last.target_lang || (elTargetLang?.value || "es"),
      fields: last.fields || {},
    };

    // Try primary endpoint
    let res = await fetch(PDF_API_PRIMARY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Fallback if endpoint doesn’t exist
    if (!res.ok) {
      res = await fetch(PDF_API_FALLBACK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`PDF export failed (${res.status}). ${t}`.trim());
    }

    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voyadecir.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleFile(file) {
    setError("");
    setStatus("Uploading...");
    setDisabled(elDownloadBtn, true);

    const ocr = await ocrParse(file);
    const text = (ocr.text || "").trim();

    if (elOcrText) elOcrText.value = text;

    if (!text) {
      setStatus("Ready");
      throw new Error("OCR returned no text. Try a clearer photo or PDF.");
    }

    setStatus("Analyzing...");
    const result = await interpretText(text);

    if (elSummaryText) elSummaryText.value = result.summary || "";

    window.__MB_LAST = {
      ocr_text: text,
      summary: result.summary || "",
      target_lang: result.lang || (elTargetLang?.value || "es"),
      fields: result.fields || {},
      raw: result,
    };

    setDisabled(elDownloadBtn, false);
    setStatus("Done");
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    await handleFile(files[0]);
  }

  function wire() {
    // Upload
    if (elUploadBtn && elFileInput) {
      elUploadBtn.addEventListener("click", () => elFileInput.click());
      elUploadBtn.addEventListener("pointerup", () => elFileInput.click());
    }

    // Camera
    if (elCameraBtn && elCameraInput) {
      elCameraBtn.addEventListener("click", () => elCameraInput.click());
      elCameraBtn.addEventListener("pointerup", () => elCameraInput.click());
    }

    // Input change
    if (elFileInput) {
      elFileInput.addEventListener("change", async (e) => {
        try {
          const files = e.target.files ? Array.from(e.target.files) : [];
          await handleFiles(files);
        } catch (err) {
          setError(String(err?.message || err));
          setStatus("Ready");
        } finally {
          // allow re-uploading same file
          try { elFileInput.value = ""; } catch (_) {}
        }
      });
    }

    if (elCameraInput) {
      elCameraInput.addEventListener("change", async (e) => {
        try {
          const files = e.target.files ? Array.from(e.target.files) : [];
          await handleFiles(files);
        } catch (err) {
          setError(String(err?.message || err));
          setStatus("Ready");
        } finally {
          try { elCameraInput.value = ""; } catch (_) {}
        }
      });
    }

    // Clear
    if (elClearBtn) {
      elClearBtn.addEventListener("click", () => {
        setError("");
        setStatus("Ready");
        if (elOcrText) elOcrText.value = "";
        if (elSummaryText) elSummaryText.value = "";
        setDisabled(elDownloadBtn, true);
        window.__MB_LAST = null;
      });
    }

    // Download PDF
    if (elDownloadBtn) {
      elDownloadBtn.addEventListener("click", async () => {
        try {
          const last = window.__MB_LAST;
          if (!last?.ocr_text) return;
          setError("");
          setStatus("Exporting PDF...");
          await exportPdf(last);
          setStatus("Done");
        } catch (err) {
          setError(String(err?.message || err));
          setStatus("Ready");
        }
      });
    }

    // If “More” exists on this page, don’t let it be a dead click
    if (elMoreBtn) {
      elMoreBtn.addEventListener("click", () => {
        // main.js handles nav; this prevents “nothing happens” on some browsers
      });
    }

    setStatus("Ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
