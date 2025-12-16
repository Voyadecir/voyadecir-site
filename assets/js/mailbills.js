/* =========================================================
   Voyadecir – Mail & Bills
   Restored OCR-safe pipeline + auto-translation
   ========================================================= */

const OCR_API_BASE =
  window.OCR_API_BASE ||
  "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

let uploadedFiles = [];
let combinedText = "";

/* -------------------------
   Utilities
-------------------------- */
function $(id) {
  return document.getElementById(id);
}

function showStatus(msg) {
  const el = $("mb-status");
  if (el) el.textContent = msg;
}

function showError(msg) {
  const el = $("mb-error");
  if (el) {
    el.textContent = msg;
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

/* -------------------------
   OCR – SAFE BYTES SENDER
-------------------------- */
async function sendBytes(file) {
  const buf = await file.arrayBuffer();
  const url = `${OCR_API_BASE}/api/mailbills/parse`;

  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    throw new Error(
      "HEIC images are not supported yet. Please upload JPG, PNG, or PDF."
    );
  }

  let contentType = "application/octet-stream";
  if (type === "application/pdf" || name.endsWith(".pdf"))
    contentType = "application/pdf";
  else if (type.includes("jpeg") || name.endsWith(".jpg") || name.endsWith(".jpeg"))
    contentType = "image/jpeg";
  else if (type.includes("png") || name.endsWith(".png"))
    contentType = "image/png";
  else if (type.includes("tiff") || name.endsWith(".tif") || name.endsWith(".tiff"))
    contentType = "image/tiff";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      "x-filename": file.name || "upload"
    },
    body: buf
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/* -------------------------
   Agent + Translation
-------------------------- */
async function runAgentPipeline(text, fields) {
  const res = await fetch("/api/mailbills/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      fields,
      lang: window.currentLang || "en"
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Agent error");

  if ($("summary-text")) $("summary-text").textContent = data.summary || "";
}

async function translateOcrText() {
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: combinedText,
      target_lang: window.currentLang || "en"
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Translation failed");

  if ($("ocr-text")) $("ocr-text").textContent = data.translation || "";
}

/* -------------------------
   File Handling
-------------------------- */
async function handleFile(file) {
  showStatus("Analyzing document…");
  clearError();

  const ocrData = await sendBytes(file);

  const text =
    ocrData.text ||
    ocrData.content ||
    ocrData.raw ||
    "";

  combinedText += "\n\n" + text;

  if ($("ocr-text")) $("ocr-text").textContent = combinedText;

  await runAgentPipeline(text, ocrData.fields || null);
  await translateOcrText();
}

async function handleFiles(files) {
  combinedText = "";
  uploadedFiles = Array.from(files);

  for (const file of uploadedFiles) {
    await handleFile(file);
  }

  showStatus("Done");
}

/* -------------------------
   Init
-------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const input = $("mb-file-input");
  if (!input) return;

  input.addEventListener("change", async (e) => {
    try {
      await handleFiles(e.target.files);
    } catch (err) {
      showError(err.message || "Upload failed");
    }
  });
});
