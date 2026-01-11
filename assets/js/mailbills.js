(() => {
  "use strict";

  // ===== Endpoints (unchanged engine; frontend-only behavior changes) =====
  const AZURE_FUNCS_BASE =
    (window.VOY_AZURE_FUNCS_BASE ||
      "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net"
    ).replace(/\/$/, "");

  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com"
    ).replace(/\/$/, "");

  const URL_PARSE = `${AZURE_FUNCS_BASE}/api/mailbills/parse`;
  const URL_INTERPRET = `${AI_TRANSLATOR_BASE}/api/mailbills/interpret`;
  const URL_TRANSLATE = `${AI_TRANSLATOR_BASE}/api/translate`;

  // ===== Helpers =====
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);

  function uiLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  function setStatus(msg) {
    const el = $("#status-line");
    if (el) el.textContent = String(msg ?? "");
  }

  function setBusy(isBusy) {
    ["#btn-upload", "#btn-camera", "#mb-clear"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!isBusy;
    });
  }

  function getFileInput() { return $("#file-input"); }
  function getCamInput() { return $("#camera-input"); }

  function ocrBox() { return $("#ocr-text"); }
  function englishBox() { return $("#summary-en"); }
  function spanishBox() { return $("#summary-es"); }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    let text = "";
    try { text = await res.text(); } catch (_) {}
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, text };
  }

  // ===== OCR (unchanged transport: sends raw bytes; do NOT change engine) =====
  async function parseAzure(file) {
    // Read bytes
    const buf = await file.arrayBuffer();
    const out = await fetchJson(URL_PARSE, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name || "upload"),
      },
      body: buf,
    });

    if (!out.ok) {
      const msg =
        out.json?.detail ||
        out.json?.message ||
        out.text ||
        `OCR failed with HTTP ${out.status}.`;
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

    return { kind: "ocr", text: String(text) };
  }

  // ===== DEMO MODE (locked) =====
  // 1) Interpret ONCE in English
  // 2) Spanish is ONLY a mirrored translation of the English explanation (no re-analysis)
  async function interpretEnglish(text) {
    const out = await fetchJson(URL_INTERPRET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_lang: "en",
        ui_lang: uiLang(),
      }),
    });

    if (!out.ok) {
      const msg =
        out.json?.detail ||
        out.json?.message ||
        out.text ||
        `Interpret failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

    return out.json || {};
  }

  async function translateText(text, targetLang) {
    const out = await fetchJson(URL_TRANSLATE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_lang: targetLang,
      }),
    });

    if (!out.ok) {
      const msg =
        out.json?.detail ||
        out.json?.message ||
        out.text ||
        `Translate failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

    // Accept a few plausible shapes without touching backend
    const j = out.json || {};
    return (
      j.translation ||
      j.translated_text ||
      j.text ||
      j.result?.translation ||
      j.result?.translated_text ||
      ""
    );
  }

  function extractEnglishExplanation(data) {
    return String(
      data.summary ||
      data.explanation ||
      data.message ||
      data.result?.summary ||
      data.result?.explanation ||
      ""
    );
  }

  function renderExtras(data) {
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

  function renderClarifications(list) {
    const items = Array.isArray(list) ? list : [];
    const wrap = document.getElementById("clarification-section");
    const ul = document.getElementById("clarification-list");
    if (!wrap || !ul) return;

    ul.innerHTML = "";

    if (!items.length) {
      wrap.style.display = "none";
      return;
    }

    const bullets = items
      .map((item) => item?.prompt || item?.question || item?.word || "")
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    bullets.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = q;
      ul.appendChild(li);
    });

    wrap.style.display = "block";
    setStatus("We found possible ambiguities. Please clarify:");
  }

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    setBusy(true);
    setStatus("Reading document…");

    try {
      const file = list[0];

      setStatus("Running OCR…");
      const parsed = await parseAzure(file);
      if (ocrBox()) ocrBox().value = parsed.text;

      setStatus("Generating English explanation…");
      const data = await interpretEnglish(parsed.text);

      const en = extractEnglishExplanation(data);
      if (englishBox()) englishBox().value = en;

      setStatus("Translating explanation to Spanish…");
      const es = await translateText(en, "es");
      if (spanishBox()) spanishBox().value = String(es || "");

      renderExtras(data);
      renderClarifications(data?.clarifications);

      setStatus("Done");
    } catch (err) {
      setStatus(err?.message ? err.message : String(err));
    } finally {
      setBusy(false);
      const fi = getFileInput();
      const ci = getCamInput();
      if (fi) fi.value = "";
      if (ci) ci.value = "";
    }
  }

  function wire() {
    const btnUpload = $("#btn-upload");
    const btnCamera = $("#btn-camera");
    const btnClear = $("#mb-clear");

    const fileInput = getFileInput();
    const camInput = getCamInput();

    if (!fileInput || !camInput) {
      console.warn("Voyadecir demo: missing file inputs.");
      return;
    }

    const clickFile = () => fileInput.click();
    const clickCam = () => camInput.click();

    on(btnUpload, "click", clickFile);
    on(btnUpload, "pointerup", clickFile);

    on(btnCamera, "click", clickCam);
    on(btnCamera, "pointerup", clickCam);

    on(fileInput, "change", (e) => handleFiles(e.target.files));
    on(camInput, "change", (e) => handleFiles(e.target.files));

    on(btnClear, "click", () => {
      if (ocrBox()) ocrBox().value = "";
      if (englishBox()) englishBox().value = "";
      if (spanishBox()) spanishBox().value = "";

      ["identity-section", "payment-section", "other-amounts-section", "clarification-section"].forEach((id) => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = "none";
      });

      setStatus("Ready");
    });

    // Copy buttons
    on($("#mb-copy-text"), "click", () => {
      const v = ocrBox()?.value || "";
      if (v) navigator.clipboard?.writeText(v).catch(() => {});
    });
    on($("#mb-copy-en"), "click", () => {
      const v = englishBox()?.value || "";
      if (v) navigator.clipboard?.writeText(v).catch(() => {});
    });
    on($("#mb-copy-es"), "click", () => {
      const v = spanishBox()?.value || "";
      if (v) navigator.clipboard?.writeText(v).catch(() => {});
    });

    setStatus("Ready");
  }

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wire);
    } else {
      wire();
    }
  } catch (e) {
    console.error("Voyadecir demo failed to initialize:", e);
  }
})();
