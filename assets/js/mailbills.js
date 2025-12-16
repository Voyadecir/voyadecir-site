/* =========================================================
   Voyadecir – Mail & Bills Helper
   - Restores OCR request format (fixes HTTP 415)
   - Auto-translate full text every time
   - Keeps summary + explanation output
   - Wires all UI buttons (upload/camera/copy/clear/pdf)
   ========================================================= */

const OCR_API_BASE =
  window.OCR_API_BASE ||
  "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

let combinedText = "";
let lastTranslation = "";
let lastSummary = "";

/* -------------------------
   DOM helpers
-------------------------- */
function $(id) {
  return document.getElementById(id);
}

function getUiLang() {
  // Site UI language (Clara + labels)
  return (
    window.currentLang ||
    localStorage.getItem("voyadecir_lang") ||
    document.documentElement.lang ||
    "en"
  );
}

function getTargetLang() {
  // Translation target language for the document
  const sel = $("mb-tgt-lang");
  return (sel && sel.value) ? sel.value : "es";
}

function setStatus(msg) {
  const el = $("mb-status");
  if (el) el.textContent = msg;
}

function showError(msg) {
  const el = $("mb-error");
  if (el) {
    el.textContent = msg || "Something went wrong.";
    el.style.display = "block";
  }
}

function clearError() {
  const el = $("mb-error");
  if (el) {
    el.textContent = "";
    el.style.display = "none";
  }
}

function setText(id, value) {
  const el = $(id);
  if (el) el.value = value || "";
}

function enablePdf(enabled) {
  const btn = $("mb-download-pdf");
  if (btn) btn.disabled = !enabled;
}

/* -------------------------
   OCR upload (binary) – FIXES 415
-------------------------- */
async function sendBytes(file) {
  const url = `${OCR_API_BASE}/api/mailbills/parse`;
  const buf = await file.arrayBuffer();

  const name = (file?.name || "").toLowerCase();
  const type = (file?.type || "").toLowerCase();

  // HEIC/HEIF often causes UnsupportedMediaType in DI
  const isHeic =
    type.includes("heic") || type.includes("heif") ||
    name.endsWith(".heic") || name.endsWith(".heif");

  if (isHeic) {
    throw new Error(
      "HEIC photos aren't supported yet. Please upload JPG/PNG or a PDF."
    );
  }

  // DI accepts octet-stream but better to be explicit when we can
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isJpg =
    type === "image/jpeg" ||
    type === "image/jpg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg");
  const isPng = type === "image/png" || name.endsWith(".png");
  const isTiff = type === "image/tiff" || name.endsWith(".tif") || name.endsWith(".tiff");

  const contentType =
    isPdf ? "application/pdf" :
    isJpg ? "image/jpeg" :
    isPng ? "image/png" :
    isTiff ? "image/tiff" :
    "application/octet-stream";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-filename": file?.name || "upload"
    },
    body: buf
  });

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      (data?.error?.message) ||
      `Analyze call failed with HTTP ${res.status}.`;
    throw new Error(msg);
  }

  return data;
}

/* -------------------------
   Deep agent summary/explanation
-------------------------- */
async function runAgentPipeline(text, fields) {
  const res = await fetch("/api/mailbills/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      fields: fields || null,
      lang: getUiLang()
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Agent interpretation failed.");
  }

  lastSummary = data?.summary || "";
  setText("summary-text", lastSummary);
}

/* -------------------------
   Full professional translation (always)
-------------------------- */
async function translateFullText() {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: combinedText,
      target_lang: getTargetLang()
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || "Translation failed.");
  }

  lastTranslation = data?.translation || "";
  setText("ocr-text", lastTranslation);
}

/* -------------------------
   PDF export
   - expects backend endpoint that returns application/pdf
-------------------------- */
async function downloadPdf() {
  try {
    clearError();
    setStatus("Preparing PDF…");

    const payload = {
      lang: getTargetLang(),
      original_text: combinedText,
      translated_text: lastTranslation,
      summary: lastSummary
    };

    const res = await fetch("/api/mailbills/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(t || "PDF export failed.");
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "voyadecir-translated.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    setStatus("PDF downloaded.");
  } catch (err) {
    showError(err?.message || "PDF export failed.");
    setStatus("Ready");
  }
}

/* -------------------------
   Main flow
-------------------------- */
async function handleOneFile(file) {
  clearError();
  setStatus("Analyzing document…");

  const ocrData = await sendBytes(file);

  const text =
    ocrData?.text ||
    ocrData?.content ||
    "";

  if (!text) {
    throw new Error("OCR returned no text. Try a clearer photo or PDF.");
  }

  // accumulate
  combinedText = combinedText ? `${combinedText}\n\n${text}` : text;

  // show raw extracted first (in case translation takes a sec)
  setText("ocr-text", combinedText);

  // deep agent summary/explanation (per-file)
  await runAgentPipeline(text, ocrData?.fields || null);

  // always translate the full accumulated text
  setStatus("Translating full text…");
  await translateFullText();

  enablePdf(true);
  setStatus("Done");
}

async function handleFiles(fileList) {
  combinedText = "";
  lastTranslation = "";
  lastSummary = "";
  enablePdf(false);
  setText("ocr-text", "");
  setText("summary-text", "");

  const files = Array.from(fileList || []);
  if (!files.length) return;

  for (const f of files) {
    await handleOneFile(f);
  }
}

/* -------------------------
   UI wiring
-------------------------- */
function copyFrom(id) {
  const el = $(id);
  if (!el) return;

  const text = el.value || "";
  if (!text) return;

  navigator.clipboard.writeText(text).then(
    () => setStatus("Copied."),
    () => showError("Copy failed. Your browser blocked clipboard access.")
  );
}

function clearAll() {
  combinedText = "";
  lastTranslation = "";
  lastSummary = "";
  enablePdf(false);
  setText("ocr-text", "");
  setText("summary-text", "");
  clearError();
  setStatus("Ready");
}

function swapLanguages() {
  // simple swap between EN and current target (good enough for now)
  const sel = $("mb-tgt-lang");
  if (!sel) return;

  const cur = sel.value || "es";
  sel.value = (cur === "en") ? "es" : "en";
}

document.addEventListener("DOMContentLoaded", () => {
  // Inputs
  const fileInput = $("mb-file-input");
  const camInput = $("mb-camera-input");

  // Buttons
  const btnUpload = $("btn-upload");
  const btnCam = $("btn-camera");
  const btnClear = $("mb-clear");
  const btnCopyOcr = $("mb-copy-ocr");
  const btnCopySummary = $("mb-copy-summary");
  const btnPdf = $("mb-download-pdf");
  const btnSwap = $("mb-swap-langs");

  // Wire triggers
  if (btnUpload && fileInput) btnUpload.addEventListener("click", () => fileInput.click());
  if (btnCam && camInput) btnCam.addEventListener("click", () => camInput.click());

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      try {
        await handleFiles(e.target.files);
      } catch (err) {
        showError(err?.message || "Upload failed.");
        setStatus("Ready");
      } finally {
        fileInput.value = "";
      }
    });
  }

  if (camInput) {
    camInput.addEventListener("change", async (e) => {
      try {
        await handleFiles(e.target.files);
      } catch (err) {
        showError(err?.message || "Upload failed.");
        setStatus("Ready");
      } finally {
        camInput.value = "";
      }
    });
  }

  if (btnClear) btnClear.addEventListener("click", clearAll);
  if (btnCopyOcr) btnCopyOcr.addEventListener("click", () => copyFrom("ocr-text"));
  if (btnCopySummary) btnCopySummary.addEventListener("click", () => copyFrom("summary-text"));
  if (btnPdf) btnPdf.addEventListener("click", downloadPdf);
  if (btnSwap) btnSwap.addEventListener("click", swapLanguages);

  // Changing translation target should re-translate instantly (nice UX)
  const sel = $("mb-tgt-lang");
  if (sel) {
    sel.addEventListener("change", async () => {
      if (!combinedText) return;
      try {
        setStatus("Translating full text…");
        await translateFullText();
        setStatus("Done");
      } catch (err) {
        showError(err?.message || "Translation failed.");
        setStatus("Ready");
      }
    });
  }

  clearAll();
});
