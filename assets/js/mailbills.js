// Mail & Bills — client → OCR (Azure Functions) + Deep Agent (ai-translator)

// ---------- 1) API endpoints ----------

// Azure Functions: OCR only
const OCR_API_BASE =
  "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

// Render backend: deep agent + translator
const INTERPRET_API_BASE = "https://ai-translator-i5jb.onrender.com";
const TRANSLATE_API = `${INTERPRET_API_BASE}/api/translate`;

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

// ---------- 4) Render extracted fields card ----------

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
    amt != null && !isNaN(amt)
      ? `$${Number(amt).toFixed(2)}`
      : valOrDash(amt);

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

  const any = [amt, due, acc, snd, adr].some(
    (x) => x && String(x).trim() !== ""
  );
  card.style.display = any ? "block" : "none";
}

// ---------- 5) Call OCR (Azure Function) ----------

async function sendBytes(file, lang) {
  const buf = await file.arrayBuffer();
  const url = `${OCR_API_BASE}/api/mailbills/parse?target_lang=${encodeURIComponent(
    lang
  )}`;
  const contentType = file.type || "application/octet-stream";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType },
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

// ---------- 6) Call Deep Agent (ai-translator) ----------

async function callInterpret(ocrText, targetLangCode) {
  const norm = (targetLangCode || "").toLowerCase();
  const locale = norm.startsWith("es") ? "es-MX" : "en-US";

  const payload = {
    ocr_text: ocrText,
    locale,
    document_kind: "utility_bill",
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

// ---------- 7) Main handler: upload → OCR → interpret ----------

async function handleFile(file) {
  if (!file) return;

  // Site language (UI) vs target language (summary/translation)
  const siteLang = getLang() === "es" ? "es" : "en";

  const tgtSelect = $("#mb-tgt-lang");
  const targetLang =
    (tgtSelect?.value || siteLang).trim(); // 'es' or 'en'

  setStatus(translateKey("mb.status.uploading", "Uploading document…"));

  try {
    // Step 1: OCR via Azure Functions (siteLang doesn't really matter here)
    const ocrData = await sendBytes(file, siteLang);
    setStatus(translateKey("mb.status.ocrDone", "Text extracted."));

    const ocrText =
      ocrData.ocr_text_snippet ||
      ocrData.ocr_text ||
      ocrData.full_text ||
      ocrData.message ||
      "";

    const ocrEl = $("#ocr-text");
    if (ocrEl) ocrEl.value = ocrText;

    // Optional: show any fields from OCR pipeline (usually empty until agent fills them)
    if (ocrData.fields) {
      showResults(ocrData.fields);
    }

    // Step 2: Deep interpret via ai-translator, in targetLang
    try {
      const agentData = await callInterpret(ocrText, targetLang);

      const sumEl = $("#summary-text");
      const summaryText =
        agentData.summary_translated ||
        agentData.summary_en ||
        agentData.summary ||
        "";

      if (sumEl) sumEl.value = summaryText;

      if (agentData.fields) {
        showResults(agentData.fields);
      }

      setStatus(
        translateKey(
          "mb.status.doneWithAgent",
          "Done. Summary and fields extracted."
        )
      );
    } catch (err) {
      console.error(
        "[mailbills] interpret error, falling back to OCR-only:",
        err
      );
      setStatus(
        translateKey(
          "mb.status.done",
          "Done. Deep analysis unavailable, showing raw text."
        )
      );
    }
  } catch (err) {
    console.error("[mailbills] error:", err);
    setStatus(
      translateKey("mb.status.serverError", "Server error. Try again.")
    );
    alert(
      "Server error. Please check Azure Function logs, Render logs, keys/endpoints, and CORS."
    );
  }
}

// ---------- 8) Translate OCR text via existing translator ----------

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
      setStatus(
        translateKey("mb.status.translationFailed", "Translation failed.")
      );
      return;
    }

    const data = await res.json();
    const out = data.translated_text || data.translation || "";
    if (!out) {
      setStatus(
        translateKey(
          "mb.status.emptyTranslation",
          "Empty translation."
        )
      );
      return;
    }

    outEl.value = out;
    setStatus(translateKey("mb.status.translated", "Translated."));
  } catch (err) {
    console.error("Translation network error", err);
    setStatus(
      translateKey("mb.status.translationError", "Translation error.")
    );
  }
}

// ---------- 9) UI wiring ----------

window.addEventListener("DOMContentLoaded", function () {
  const tgt = $("#mb-tgt-lang");
  if (tgt) {
    // Initialize dropdown from site language
    tgt.value = getLang() === "es" ? "es" : "en";

    // If user changes "To" language, sync it back to site language store
    tgt.addEventListener("change", () => {
      try {
        sessionStorage.setItem("voyadecir_lang", tgt.value);
      } catch (_) {}
    });
  }

  $("#btn-upload")?.addEventListener("click", () =>
    $("#file-input").click()
  );
  $("#btn-camera")?.addEventListener("click", () =>
    $("#camera-input").click()
  );

  $("#file-input")?.addEventListener("change", (e) =>
    handleFile(e.target.files?.[0])
  );
  $("#camera-input")?.addEventListener("change", (e) =>
    handleFile(e.target.files?.[0])
  );

  // EN↔ES toggle for "To" (just flips the select and syncs it)
  $("#mb-swap-langs")?.addEventListener("click", () => {
    const t = $("#mb-tgt-lang");
    if (!t) return;
    t.value = t.value === "es" ? "en" : "es";
    try {
      sessionStorage.setItem("voyadecir_lang", t.value);
    } catch (_) {}
  });

  // Make sure the "Translate" button really calls translateOcrText
  const translateButtons = [
    "#mb-translate-run",
    "#mb-translate-btn", // fallback if HTML used a different id
  ];

  translateButtons.forEach((sel) => {
    const btn = $(sel);
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      translateOcrText();
    });
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

    setStatus(translateKey("mb.status.cleared", "Cleared."));
  });

  setStatus(translateKey("mb.status.ready", "Ready"));
});
