/* Voyadecir Mail & Bills Helper (front-end)
   - Upload photo/PDF
   - Calls Azure Functions OCR (/api/mailbills/parse)
   - Calls ai-translator deep agent (/api/mailbills/interpret)
   - Updates UI
*/

(function () {
  "use strict";

  // ---------- 0) Config ----------
  const OCR_API_BASE =
    window.OCR_API_BASE ||
    "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";
  const AGENT_API_BASE =
    window.AGENT_API_BASE || "https://ai-translator-i5jb.onrender.com";

  // ---------- 1) Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function setStatus(msg) {
    const el = $("#mb-status");
    if (el) el.textContent = msg || "";
  }

  function setError(msg) {
    const el = $("#mb-error");
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function setOCRText(txt) {
    const el = $("#mb-ocr-text");
    if (el) el.value = txt || "";
  }

  function setSummary(txt) {
    const el = $("#mb-summary");
    if (el) el.value = txt || "";
  }

  function enableDownloadPdf(enabled) {
    const btn = $("#mb-download-pdf");
    if (btn) btn.disabled = !enabled;
  }

  function getLang() {
    return (window.getLang && window.getLang()) || "en";
  }

  // ---------- 2) UI wiring ----------
  const fileInput = $("#mb-file");
  const uploadBtn = $("#mb-upload-btn");
  const takePhotoBtn = $("#mb-photo-btn");
  const clearBtn = $("#mb-clear-btn");
  const copyTextBtn = $("#mb-copy-text");
  const copySummaryBtn = $("#mb-copy-summary");
  const downloadPdfBtn = $("#mb-download-pdf");

  function clearAll() {
    setError("");
    setStatus("Ready");
    setOCRText("");
    setSummary("");
    enableDownloadPdf(false);
    if (fileInput) fileInput.value = "";
  }

  async function copyToClipboard(value) {
    try {
      await navigator.clipboard.writeText(value || "");
      setStatus("Copied.");
      setTimeout(() => setStatus("Ready"), 1000);
    } catch (e) {
      setStatus("Copy failed.");
      console.warn("copy failed", e);
    }
  }

  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  if (copyTextBtn)
    copyTextBtn.addEventListener("click", () =>
      copyToClipboard($("#mb-ocr-text")?.value || "")
    );
  if (copySummaryBtn)
    copySummaryBtn.addEventListener("click", () =>
      copyToClipboard($("#mb-summary")?.value || "")
    );

  // ---------- 3) File pick ----------
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      await handleFiles(files);
    });
  }

  // ---------- 4) Take picture ----------
  // Note: camera capture support varies. On mobile, <input capture> handles this best.
  if (takePhotoBtn && fileInput) {
    takePhotoBtn.addEventListener("click", () => {
      fileInput.setAttribute("capture", "environment");
      fileInput.click();
      setTimeout(() => fileInput.removeAttribute("capture"), 2000);
    });
  }

  // ---------- 5) Main workflow ----------
  async function handleFiles(files) {
    if (!files || !files.length) return;
    clearAll();
    setStatus("Uploading...");
    setError("");

    try {
      // For now, handle the first file only.
      const file = files[0];
      const ocr = await sendBytes(file);

      if (!ocr?.ok) {
        setError(ocr?.message || "OCR failed.");
        setStatus("Ready");
        return;
      }

      const text = ocr.text || "";
      setOCRText(text);

      setStatus("Analyzing...");
      const interpretation = await callInterpret(text);

      if (!interpretation?.ok) {
        setError(interpretation?.message || "Analysis failed.");
        setStatus("Ready");
        return;
      }

      setSummary(interpretation.summary || "");
      enableDownloadPdf(true);
      setStatus("Done");

      // Store last payload for PDF export
      window.__MB_LAST = {
        ocr_text: text,
        summary: interpretation.summary || "",
        lang: interpretation.lang || "",
        fields: interpretation.fields || {},
        raw: interpretation,
      };
    } catch (err) {
      console.error("[mailbills] error:", err);
      setError(String(err?.message || err));
      setStatus("Ready");
    }
  }

  // ---------- 6) Call Azure OCR ----------
  async function sendBytes(file) {
    const buf = await file.arrayBuffer();
    const url = `${OCR_API_BASE}/api/mailbills/parse`;

    let contentType = file.type || "application/octet-stream";
    // Safari/iOS sometimes gives an empty file.type. Fall back to filename-based detection.
    if (contentType === "application/octet-stream" && file?.name) {
      const lower = String(file.name).toLowerCase();
      if (lower.endsWith(".pdf")) contentType = "application/pdf";
      else if (lower.endsWith(".png")) contentType = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
    }

    // Best-effort: include filename for debugging
    const headers = { "Content-Type": contentType };
    try {
      if (file?.name) headers["x-filename"] = file.name;
    } catch (_) {}

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: buf,
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }

    if (!res.ok || !data?.ok) {
      console.warn("[mailbills] /parse response:", data);
      const msg =
        data?.message ||
        `Server error (${res.status}).`;
      throw new Error(msg);
    }

    return data;
  }

  // ---------- 7) Call Deep Agent (ai-translator) ----------
  async function callInterpret(ocrText) {
    const langSelect = $("#mb-tgt-lang");
    const target_lang = (
      langSelect?.value || (getLang() === "es" ? "es" : "en")
    ).trim();

    const payload = {
      ocr_text: ocrText,
      target_lang,
      source_hint: "auto",
    };

    const url = `${AGENT_API_BASE}/api/mailbills/interpret`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      console.warn("[mailbills] /interpret response:", data);
      return {
        ok: false,
        message: data?.message || `Interpret failed (${res.status}).`,
      };
    }

    return data;
  }

  // ---------- 8) PDF download ----------
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener("click", async () => {
      try {
        const last = window.__MB_LAST;
        if (!last?.ocr_text) return;

        setStatus("Exporting PDF...");

        const url = `${AGENT_API_BASE}/api/mailbills/pdf`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ocr_text: last.ocr_text,
            summary: last.summary,
            target_lang: last.lang || (getLang() === "es" ? "es" : "en"),
            fields: last.fields || {},
          }),
        });

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
        setStatus("Done");
      } catch (err) {
        console.error("[mailbills] pdf error:", err);
        setError(String(err?.message || err));
        setStatus("Ready");
      }
    });
  }

  // ---------- Init ----------
  clearAll();
})();
