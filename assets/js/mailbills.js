// Mail & Bills — client → Azure Function + deep agent
// Flow:
//   1) Upload file → /api/mailbills/parse (OCR)
//   2) Take OCR text → /api/mailbills/interpret (deep agent)
//   3) Show fields + summaries in UI.

// 1) Use your actual Function App default domain
const API_BASE = "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";
const TRANSLATE_API = "https://ai-translator-i5jb.onrender.com/api/translate";

const translateKey = (key, fallback) => {
  try {
    if (typeof window !== "undefined" && typeof window.voyT === "function") {
      return window.voyT(key, fallback);
    }
  } catch (_) {}
  return fallback || key;
};

// 2) Site language helper (from main.js session key)
function getLang() {
  try {
    return sessionStorage.getItem("voyadecir_lang") || "en";
  } catch (_) {
    return "en";
  }
}

// 3) Tiny DOM helpers
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
    setStatus(
      translateKey("mb.status.nothingToCopy", "Nothing to copy.")
    );
    return;
  }

  navigator.clipboard
    ?.writeText(value)
    .then(() =>
      setStatus(
        translateKey("mb.status.copied", "Copied to clipboard.")
      )
    )
    .catch(() =>
      setStatus(
        translateKey("mb.status.copyFailed", "Could not copy.")
      )
    );
}

// 4) Render extracted fields card
function showResults(fieldsRaw) {
  const card = $("#results-card");
  if (!card) return;

  const f = fieldsRaw || {};

  // Support both nested { amount_due: { value } } and flat { amount_due: "123" }
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

  $("#r-amount").textContent = amountText;
  $("#r-duedate").textContent = valOrDash(due);
  $("#r-acct").textContent = valOrDash(acc);
  $("#r-sender").textContent = valOrDash(snd);
  $("#r-address").textContent = valOrDash(adr);

  const any = [amt, due, acc, snd, adr].some(
    (x) => x && String(x).trim() !== ""
  );
  card.style.display = any ? "block" : "none";
}

// 5) POST raw bytes to Function (OCR only)
async function sendBytes(file) {
  const buf = await file.arrayBuffer();
  const lang = getLang() === "es" ? "es" : "en";
  const url = `${API_BASE}/api/mailbills/parse?target_lang=${encodeURIComponent(
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

// 6) Call deep agent to interpret OCR text
async function callInterpret(ocrText, targetLang) {
  const url = `${API_BASE}/api/mailbills/interpret`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ocr_text: ocrText,
      target_lang: targetLang,
    }),
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

// 7) Main handler: upload → OCR → interpret → UI
async function handleFile(file) {
  if (!file) return;
  const uiLang = getLang() === "es" ? "es" : "en";

  setStatus(
    translateKey("mb.status.uploading", "Uploading document…")
  );

  try {
    // Step 1: OCR
    const ocrData = await sendBytes(file);
    setStatus(
      translateKey(
        "mb.status.ocrDone",
        "Text extracted. Running AI helper…"
      )
    );

    // Combine possible OCR fields
    const ocrText =
      ocrData.ocr_text ||
      ocrData.ocr_text_snippet ||
      ocrData.full_text ||
      ocrData.message ||
      "";

    const ocrEl = $("#ocr-text");
    if (ocrEl) ocrEl.value = ocrText;

    // Step 2: Deep agent interpretation
    let summaryText = "";
    let fields = null;

    try {
      const interp = await callInterpret(ocrText, uiLang);
      summaryText =
        interp.summary_translated ||
        interp.summary_en ||
        interp.summary ||
        "";
      fields = interp.fields || interp;
    } catch (e) {
      console.error("[mailbills] interpret error, falling back to OCR-only:", e);

      // Fallback: use whatever the OCR endpoint returned (if anything)
      summaryText =
        ocrData.summary_translated ||
        ocrData.summary_en ||
        ocrData.summary ||
        "";
      fields = ocrData.fields || ocrData;
    }

    const sumEl = $("#summary-text");
    if (sumEl) sumEl.value = summaryText;

    showResults(fields);

    setStatus(translateKey("mb.status.done", "Done."));
  } catch (err) {
    console.error("[mailbills] error:", err);
    setStatus(
      translateKey("mb.status.serverError", "Server error. Try again.")
    );
    alert(
      "Server error. Please check Azure Function logs, keys/endpoints, and CORS."
    );
  }
}

// 8) Translate OCR text into target language (optional extra)
async function translateOcrText() {
  const srcEl = $("#ocr-text");
  const outEl = $("#summary-text");
  const langSelect = $("#mb-tgt-lang");

  if (!srcEl || !outEl) {
    return;
  }

  const text = (srcEl.value || "").trim();
  if (!text) {
    setStatus(
      translateKey("mb.status.noText", "No text to translate.")
    );
    return;
  }

  const target_lang = (
    langSelect?.value || (getLang() === "es" ? "es" : "en")
  ).trim();

  setStatus(
    translateKey("mb.status.translating", "Translating…")
  );

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
        translateKey(
          "mb.status.translationFailed",
          "Translation failed."
        )
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
    setStatus(
      translateKey("mb.status.translated", "Translated.")
    );
  } catch (err) {
    console.error("Translation network error", err);
    setStatus(
      translateKey(
        "mb.status.translationError",
        "Translation error."
      )
    );
  }
}

// 9) UI wiring
window.addEventListener("DOMContentLoaded", function () {
  const tgt = $("#mb-tgt-lang");
  if (tgt) tgt.value = getLang() === "es" ? "es" : "en";

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

  // quick flip EN↔ES for "To"
  $("#mb-swap-langs")?.addEventListener("click", () => {
    const t = $("#mb-tgt-lang");
    if (!t) return;
    t.value = t.value === "es" ? "en" : "es";
    try {
      sessionStorage.setItem("voyadecir_lang", t.value);
    } catch (_) {}
  });

  $("#mb-translate-run")?.addEventListener("click", (e) => {
    e.preventDefault();
    translateOcrText();
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
