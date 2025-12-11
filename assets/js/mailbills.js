// Mail & Bills — client → OCR (Azure Functions) + Deep Agent (ai-translator)

// ---------- 1) API endpoints ----------

// Azure Functions: OCR only
const OCR_API_BASE =
  "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

// Render backend: deep agent + translator + (future) PDF export
const INTERPRET_API_BASE = "https://ai-translator-i5jb.onrender.com";
const TRANSLATE_API = `${INTERPRET_API_BASE}/api/translate`;

// New: PDF export endpoint (to be implemented on backend)
const PDF_EXPORT_API = `${INTERPRET_API_BASE}/api/mailbills/translate-pdf`;

// Keep track of last uploaded files so we can reuse them for PDF export
let lastUploadedFiles = [];

// ---------- 2) i18n helpers ----------

const translateKey = (key, fallback) => {
  try {
    if (typeof window !== "undefined" && typeof window.voyT === "function") {
      return window.voyT(key, fallback);
    }
  } catch (_) {}
  return fallback || key;
};

function getLang() {
  try {
    return sessionStorage.getItem("voyadecir_lang") || "en";
  } catch (_) {
    return "en";
  }
}

// ---------- 3) Tiny DOM helpers ----------

const $ = (s) => document.querySelector(s);

function setStatus(msg) {
  const el = $("#status-line");
  if (el) el.textContent = msg;
}

function valOrDash(v) {
  return v !== undefined && v !== null && String(v).trim() !== ""
    ? String(v)
    : "—";
}

function copyTextFrom(el) {
  if (!el) return;
  const value = (el.value || "").trim();
  if (!value) {
    setStatus(translateKey("mb.status.nothingToCopy", "Nothing to copy."));
    return;
  }

  navigator.clipboard
    ?.writeText(value)
    .then(() =>
      setStatus(translateKey("mb.status.copied", "Copied to clipboard."))
    )
    .catch(() =>
      setStatus(translateKey("mb.status.copyFailed", "Could not copy."))
    );
}

// ---------- 4) Field label language (EN / ES) ----------

function updateFieldLabels() {
  const lang = getLang() === "es" ? "es" : "en";

  const LABELS = {
    en: {
      title: "Key details from your bill",
      amount: "Amount due",
      due_date: "Due date",
      account: "Account #",
      sender: "Sender",
      address: "Service address",
    },
    es: {
      title: "Detalles clave de tu factura",
      amount: "Monto a pagar",
      due_date: "Fecha de vencimiento",
      account: "N.º de cuenta",
      sender: "Remitente",
      address: "Dirección del servicio",
    },
  };

  const L = LABELS[lang];

  const setText = (sel, text) => {
    const el = $(sel);
    if (el && text) el.textContent = text;
  };

  setText("#results-title", L.title);
  setText("#label-amount", L.amount);
  setText("#label-duedate", L.due_date);
  setText("#label-acct", L.account);
  setText("#label-sender", L.sender);
  setText("#label-address", L.address);
}

// ---------- 5) Helpers: field presence + merging + fallback extractor ----------

function hasAnyField(fields) {
  if (!fields || typeof fields !== "object") return false;
  const keys = ["amount_due", "due_date", "account_number", "sender", "service_address"];

  for (const key of keys) {
    const v = fields[key];
    if (v == null) continue;

    if (typeof v === "object" && "value" in v) {
      if (v.value != null && String(v.value).trim() !== "") return true;
    } else if (String(v).trim() !== "") {
      return true;
    }
  }
  return false;
}

// Merge fields from multiple pages: keep the first non-empty value
function mergeFields(base, incoming) {
  if (!incoming) return base || null;
  if (!base) return incoming;

  const out = { ...base };
  const allKeys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(incoming || {}),
  ]);

  for (const key of allKeys) {
    const prev = base[key];
    const next = incoming[key];

    const normalize = (val) => {
      if (val && typeof val === "object" && "value" in val) return val.value;
      return val;
    };

    const prevVal = normalize(prev);
    const nextVal = normalize(next);

    if (nextVal != null && String(nextVal).trim() !== "") {
      if (prevVal == null || String(prevVal).trim() === "") {
        out[key] = next;
      }
    }
  }
  return out;
}

function fallbackExtractFieldsFromText(text) {
  const full = (text || "").replace(/\s+/g, " "); // normalize whitespace

  const mkField = (value, confidence) => ({
    value: value || "",
    confidence: value ? confidence : 0.0,
  });

  // Amount due: try a few patterns
  let amount = "";
  const amountPatterns = [
    /amount\s+due[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i,
    /total\s+amount\s+due[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i,
    /amount\s+park\s+charged[^0-9$]*\$?\s*([0-9]+(?:\.[0-9]{2})?)/i,
  ];
  for (const re of amountPatterns) {
    const m = full.match(re);
    if (m && m[1]) {
      amount = m[1];
      break;
    }
  }

  // Due date: simple patterns (we can expand later)
  let dueDate = "";
  const datePatterns = [
    /due\s+date[^A-Za-z0-9]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
    /due\s+on[^A-Za-z0-9]*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const re of datePatterns) {
    const m = full.match(re);
    if (m && m[1]) {
      dueDate = m[1];
      break;
    }
  }

  // Account number: generic pattern
  let account = "";
  const acctPatterns = [/(account(?:\s+number)?\s*[:#]?\s*)([A-Za-z0-9\-]+)/i];
  for (const re of acctPatterns) {
    const m = full.match(re);
    if (m && m[2]) {
      account = m[2];
      break;
    }
  }

  // For now, sender and address are left empty in the fallback
  return {
    amount_due: mkField(amount, 0.5),
    due_date: mkField(dueDate, 0.4),
    account_number: mkField(account, 0.4),
    sender: mkField("", 0.0),
    service_address: mkField("", 0.0),
  };
}

// ---------- 6) Render extracted fields card ----------

function showResults(fieldsRaw) {
  const card = $("#results-card");
  if (!card) return;

  const f = fieldsRaw || {};

  const unwrap = (obj, key) => {
    if (!obj) return undefined;
    if (obj[key] && typeof obj[key] === "object" && "value" in obj[key]) {
      return obj[key].value;
    }
    return obj[key];
  };

  const amt = unwrap(f, "amount_due");
  const due = unwrap(f, "due_date");
  const acc = unwrap(f, "account_number");
  const snd = unwrap(f, "sender");
  const adr = unwrap(f, "service_address");

  const amountText =
    amt != null && !isNaN(amt) ? `$${Number(amt).toFixed(2)}` : valOrDash(amt);

  const ra = $("#r-amount");
  const rd = $("#r-duedate");
  const rc = $("#r-acct");
  const rs = $("#r-sender");
  const raddr = $("#r-address");

  if (ra) ra.textContent = amountText;
  if (rd) rd.textContent = valOrDash(due);
  if (rc) rc.textContent = valOrDash(acc);
  if (rs) rs.textContent = valOrDash(snd);
  if (raddr) raddr.textContent = valOrDash(adr);

  const any = [amt, due, acc, snd, adr].some((x) => x && String(x).trim() !== "");
  card.style.display = any ? "block" : "none";
}

// ---------- 7) Extra sections: identity / payment / other amounts ----------

function renderList(sectionSelector, listSelector, items) {
  const section = $(sectionSelector);
  const ul = $(listSelector);
  if (!section || !ul) return;

  ul.innerHTML = "";

  const cleaned =
    (items || []).filter((x) => typeof x === "string" && x.trim() !== "") || [];

  if (!cleaned.length) {
    section.style.display = "none";
    return;
  }

  cleaned.forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    ul.appendChild(li);
  });

  section.style.display = "block";

  const card = $("#results-card");
  if (card) card.style.display = "block";
}

function renderAgentSections(agentData) {
  if (!agentData) return;

  renderList(
    "#identity-section",
    "#identity-list",
    agentData.identity_requirements || agentData.identity || agentData.required_documents
  );

  renderList(
    "#payment-section",
    "#payment-list",
    agentData.payment_options || agentData.payment_methods || agentData.how_to_pay
  );

  renderList(
    "#other-amounts-section",
    "#other-amounts-list",
    agentData.other_important_amounts || agentData.other_amounts || agentData.fees
  );
}

// ---------- 8) Call OCR (Azure Function) ----------

async function sendBytes(file) {
  const buf = await file.arrayBuffer();
  const url = `${OCR_API_BASE}/api/mailbills/parse`;
  const contentType = file.type || "application/octet-stream";

  // Best-effort: include filename for debugging (Azure Function supports x-filename in your API wrapper)
  const headers = { "Content-Type": contentType };
  try {
    if (file?.name) headers["x-filename"] = file.name;
  } catch (_) {}

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: buf,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("[mailbills] /parse response:", data);

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`Server error: ${msg}`);
  }
  return data;
}

// ---------- 9) Call Deep Agent (ai-translator) ----------

async function callInterpret(ocrText) {
  // Use the "To" dropdown as the target language for explanation.
  const langSelect = $("#mb-tgt-lang");
  const target_lang = (
    langSelect?.value || (getLang() === "es" ? "es" : "en")
  ).trim();

  const payload = {
    ocr_text: ocrText,
    source_lang: "auto",
    target_lang,
    bill_hint: "bill, contract, or official letter",
    summary_style: "eli5",
  };

  const url = `${INTERPRET_API_BASE}/api/mailbills/interpret`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  console.log("[mailbills] /interpret response:", data);

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`Interpret error: ${msg}`);
  }

  return data;
}

// ---------- 10) Agent pipeline: take OCR text (+optional fields) → summary & fields ----------

async function runAgentPipeline(ocrText, initialFields) {
  const cleanText = (ocrText || "").trim();
  const ocrEl = $("#ocr-text");
  if (ocrEl) ocrEl.value = cleanText;

  // Show any OCR-stage fields (if present)
  if (initialFields && hasAnyField(initialFields)) {
    showResults(initialFields);
  }

  if (!cleanText) {
    setStatus(translateKey("mb.status.noText", "No text found in document."));
    return;
  }

  try {
    const agentData = await callInterpret(cleanText);

    const sumEl = $("#summary-text");
    const summaryText =
      agentData.summary_translated || agentData.summary_en || agentData.summary || "";

    if (sumEl) sumEl.value = summaryText;

    // Prefer agent fields; if empty, fall back to local extraction
    let fields = agentData.fields;
    if (!hasAnyField(fields) && cleanText) {
      fields = fallbackExtractFieldsFromText(cleanText);
    }

    if (fields) showResults(fields);

    renderAgentSections(agentData);

    setStatus(
      translateKey("mb.status.doneWithAgent", "Done. Summary and fields extracted.")
    );
  } catch (err) {
    console.error("[mailbills] interpret error, falling back to OCR-only:", err);

    // Even if agent call fails, try local extraction from OCR text
    if (cleanText) {
      const fallback = fallbackExtractFieldsFromText(cleanText);
      if (hasAnyField(fallback)) showResults(fallback);
    }

    setStatus(
      translateKey("mb.status.done", "Done. Deep analysis unavailable, showing raw text.")
    );
  }
}

// ---------- 11) Main handlers: single file vs multi-page ----------

function setPdfButtonEnabled(enabled) {
  const btn = $("#mb-download-pdf");
  if (!btn) return;
  btn.disabled = !enabled;
  btn.setAttribute("aria-disabled", (!enabled).toString());
}

async function handleFile(file) {
  if (!file) return;
  lastUploadedFiles = [file];
  setPdfButtonEnabled(true);

  setStatus(translateKey("mb.status.uploading", "Uploading document…"));

  try {
    // Step 1: OCR via Azure Functions
    const ocrData = await sendBytes(file);
    setStatus(translateKey("mb.status.ocrDone", "Text extracted."));

    const ocrText =
      ocrData.ocr_text_snippet ||
      ocrData.ocr_text ||
      ocrData.full_text ||
      ocrData.message ||
      "";

    await runAgentPipeline(ocrText, ocrData.fields || null);
  } catch (err) {
    console.error("[mailbills] error:", err);
    setStatus(translateKey("mb.status.serverError", "Server error. Try again."));
    alert(
      "Server error. Please check Azure Function logs, Render logs, keys/endpoints, and CORS."
    );
  }
}

// New: handle multiple selected files (multi-page scans, multipage contracts, etc.)
async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  lastUploadedFiles = files;
  setPdfButtonEnabled(true);

  if (files.length === 1) {
    await handleFile(files[0]);
    return;
  }

  setStatus(
    translateKey("mb.status.uploadingMulti", `Uploading and reading ${files.length} pages…`)
  );

  let combinedTextParts = [];
  let mergedFields = null;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    setStatus(
      translateKey("mb.status.processingPage", `Reading page ${i + 1} of ${files.length}…`)
    );

    try {
      const ocrData = await sendBytes(file);

      const ocrText =
        ocrData.ocr_text_snippet ||
        ocrData.ocr_text ||
        ocrData.full_text ||
        ocrData.message ||
        "";

      if (ocrText && ocrText.trim() !== "") {
        const header = `\n\n--- Page ${i + 1} ---\n\n`;
        combinedTextParts.push(header + ocrText.trim());
      }

      if (ocrData.fields) {
        mergedFields = mergeFields(mergedFields, ocrData.fields);
      }
    } catch (err) {
      console.error(`[mailbills] OCR error on page ${i + 1}`, err);
      // keep going with other pages
    }
  }

  const combinedText = combinedTextParts.join("").trim();

  if (!combinedText) {
    setStatus(translateKey("mb.status.noText", "No text found in the uploaded pages."));
    return;
  }

  setStatus(translateKey("mb.status.ocrDoneMulti", "All pages read. Analyzing…"));
  await runAgentPipeline(combinedText, mergedFields);
}

// ---------- 12) Translate OCR text via existing translator (fast full-document translation) ----------

async function translateOcrText() {
  const srcEl = $("#ocr-text");
  const outEl = $("#summary-text");
  const langSelect = $("#mb-tgt-lang");

  if (!srcEl || !outEl) return;

  const text = (srcEl.value || "").trim();
  if (!text) {
    setStatus(translateKey("mb.status.noText", "No text to translate."));
    return;
  }

  const target_lang = (
    langSelect?.value || (getLang() === "es" ? "es" : "en")
  ).trim();

  setStatus(translateKey("mb.status.translating", "Translating…"));

  try {
    const res = await fetch(TRANSLATE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target_lang }),
    });

    if (!res.ok) {
      let body;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      console.error("Translator error", res.status, body);
      setStatus(translateKey("mb.status.translationFailed", "Translation failed."));
      return;
    }

    const data = await res.json();
    const out = data.translated_text || data.translation || "";
    if (!out) {
      setStatus(translateKey("mb.status.emptyTranslation", "Empty translation."));
      return;
    }

    outEl.value = out;
    setStatus(translateKey("mb.status.translated", "Translated."));
  } catch (err) {
    console.error("Translation network error", err);
    setStatus(translateKey("mb.status.translationError", "Translation error."));
  }
}

// ---------- 13) Download professionally translated PDF (backend must implement PDF_EXPORT_API) ----------

async function downloadTranslatedPdf() {
  if (!lastUploadedFiles.length) {
    alert(
      translateKey(
        "mb.status.noFiles",
        "Upload your document first, then try downloading the PDF."
      )
    );
    return;
  }

  const langSelect = $("#mb-tgt-lang");
  const target_lang = (
    langSelect?.value || (getLang() === "es" ? "es" : "en")
  ).trim();

  setStatus(
    translateKey(
      "mb.status.generatingPdf",
      "Generating translated PDF (this can take a moment)…"
    )
  );

  try {
    const fd = new FormData();
    lastUploadedFiles.forEach((file) => fd.append("files", file));
    fd.append("target_lang", target_lang);
    fd.append("translation_style", "professional");

    const res = await fetch(PDF_EXPORT_API, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[mailbills] PDF export failed", res.status, body);
      setStatus(translateKey("mb.status.pdfFailed", "PDF export failed."));
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voyadecir-translated-document.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setStatus(translateKey("mb.status.pdfReady", "Translated PDF downloaded."));
  } catch (err) {
    console.error("[mailbills] PDF export error", err);
    setStatus(translateKey("mb.status.pdfError", "PDF export error."));
  }
}

// ---------- 14) Ensure the Download PDF button exists beside Copy Summary ----------

function ensureDownloadPdfButtonBesideCopySummary() {
  // If your HTML already has it, we won't duplicate it.
  if ($("#mb-download-pdf")) return;

  const copyBtn = $("#mb-copy-summary");
  if (!copyBtn) return;

  const parent = copyBtn.parentElement;
  if (!parent) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "mb-download-pdf";
  btn.className = "glass-button inline-btn";
  btn.disabled = true; // enabled after upload
  btn.title = translateKey("mb.pdfTitle", "Download a professionally translated PDF");

  // Button label
  btn.textContent = translateKey("mb.downloadPdf", "Download translated PDF");

  // Put it BESIDE the Copy Summary button
  parent.appendChild(btn);

  // Wire click
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadTranslatedPdf();
  });

  // Small spacing if your CSS doesn't already handle it
  try {
    parent.style.display = parent.style.display || "flex";
    parent.style.gap = parent.style.gap || "10px";
    parent.style.alignItems = parent.style.alignItems || "center";
  } catch (_) {}
}

// ---------- 15) UI wiring ----------

window.addEventListener("DOMContentLoaded", function () {
  const tgt = $("#mb-tgt-lang");
  if (tgt) tgt.value = getLang() === "es" ? "es" : "en";

  updateFieldLabels();

  // Make sure the PDF button exists beside Copy Summary (under the 2nd black box)
  ensureDownloadPdfButtonBesideCopySummary();
  setPdfButtonEnabled(false);

  $("#btn-upload")?.addEventListener("click", () => $("#file-input")?.click());
  $("#btn-camera")?.addEventListener("click", () => $("#camera-input")?.click());

  // Allow multi-file selection (multi-page documents)
  $("#file-input")?.addEventListener("change", (e) => handleFiles(e.target.files));
  $("#camera-input")?.addEventListener("change", (e) => handleFiles(e.target.files));

  // Swap “To” language and remember it
  $("#mb-swap-langs")?.addEventListener("click", () => {
    const t = $("#mb-tgt-lang");
    if (!t) return;
    t.value = t.value === "es" ? "en" : "es";
    try {
      sessionStorage.setItem("voyadecir_lang", t.value);
    } catch (_) {}
    updateFieldLabels();
  });

  // Translate button → translateOcrText
  ["#mb-translate-run", "#mb-translate-btn"].forEach((sel) => {
    const btn = $(sel);
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      translateOcrText();
    });
  });

  $("#mb-copy-text")?.addEventListener("click", (e) => {
    e.preventDefault();
    copyTextFrom($("#ocr-text"));
  });

  $("#mb-copy-ocr")?.addEventListener("click", (e) => {
    e.preventDefault();
    copyTextFrom($("#ocr-text"));
  });

  $("#mb-copy-summary")?.addEventListener("click", (e) => {
    e.preventDefault();
    copyTextFrom($("#summary-text"));
  });

  $("#mb-clear")?.addEventListener("click", (e) => {
    e.preventDefault();

    const ocr = $("#ocr-text");
    const sum = $("#summary-text");
    if (ocr) ocr.value = "";
    if (sum) sum.value = "";

    const card = $("#results-card");
    if (card) card.style.display = "none";

    ["#identity-list", "#payment-list", "#other-amounts-list"].forEach((sel) => {
      const ul = $(sel);
      if (ul) ul.innerHTML = "";
    });

    lastUploadedFiles = [];
    setPdfButtonEnabled(false);

    setStatus(translateKey("mb.status.cleared", "Cleared."));
  });

  // If the HTML already contains this id, wire it too (safe/no-dup)
  $("#mb-download-pdf")?.addEventListener("click", (e) => {
    e.preventDefault();
    downloadTranslatedPdf();
  });

  setStatus(translateKey("mb.status.ready", "Ready"));
});
