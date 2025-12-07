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

// ---------- 5) Render extracted fields card ----------

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

// ---------- 6) Extra sections: identity / payment / other amounts ----------

function renderList(sectionSelector, listSelector, items) {
  const section = $(sectionSelector);
  const ul = $(listSelector);
  if (!section || !ul) return;

  ul.innerHTML = "";

  const cleaned =
    (items || []).filter(
      (x) => typeof x === "string" && x.trim() !== ""
    ) || [];

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
  if (card) {
    card.style.display = "block";
  }
}

function renderAgentSections(agentData) {
  if (!agentData) return;

  renderList(
    "#identity-section",
    "#identity-list",
    agentData.identity_requirements ||
      agentData.identity ||
      agentData.required_documents
  );

  renderList(
    "#payment-section",
    "#payment-list",
    agentData.payment_options ||
      agentData.payment_methods ||
      agentData.how_to_pay
  );

  renderList(
    "#other-amounts-section",
    "#other-amounts-list",
    agentData.other_important_amounts ||
      agentData.other_amounts ||
      agentData.fees
  );
}

// ---------- 7) Call OCR (Azure Function) ----------

async function sendBytes(file) {
  const buf = await file.arrayBuffer();
  const url = `${OCR_API_BASE}/api/mailbills/parse`;
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

// ---------- 8) Call Deep Agent (ai-translator) ----------

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
    bill_hint: "bill or official letter",
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

// ---------- 9) Main handler: upload → OCR → interpret ----------

async function handleFile(file) {
  if (!file) return;

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

    const ocrEl = $("#ocr-text");
    if (ocrEl) ocrEl.value = ocrText;

    // Optional: show any fields the OCR pipeline already gave (usually empty)
    if (ocrData.fields) {
      showResults(ocrData.fields);
    }

    // Step 2: Deep interpret via ai-translator
    try {
      const agentData = await callInterpret(ocrText);

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

      renderAgentSections(agentData);

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

// ---------- 10) Translate OCR text via existing translator ----------

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

// ---------- 11) UI wiring ----------

window.addEventListener("DOMContentLoaded", function () {
  const tgt = $("#mb-tgt-lang");
  if (tgt) tgt.value = getLang() === "es" ? "es" : "en";

  // Make labels match current language
  updateFieldLabels();

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

    // Clear lists too
    ["#identity-list", "#payment-list", "#other-amounts-list"].forEach(
      (sel) => {
        const ul = $(sel);
        if (ul) ul.innerHTML = "";
      }
    );

    setStatus(translateKey("mb.status.cleared", "Cleared."));
  });

  setStatus(translateKey("mb.status.ready", "Ready"));
});
