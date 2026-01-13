(() => {
  "use strict";

  // ===== Endpoints (engine unchanged; frontend-only behavior) =====
  const AZURE_FUNCS_BASE =
    (window.VOY_AZURE_FUNCS_BASE ||
      "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net"
    ).replace(/\/$/, "");

  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com"
    ).replace(/\/$/, "");

  // NEW async OCR endpoints (Azure Functions)
  const URL_PARSE_START = `${AZURE_FUNCS_BASE}/api/mailbills_parse_start`;
  const URL_PARSE_STATUS = `${AZURE_FUNCS_BASE}/api/mailbills_parse_status`;

  // Existing engine endpoints (unchanged)
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

  // ===== Crash visibility (Safari loves to fail silently) =====
  window.addEventListener("error", (e) => {
    try { console.error("[mailbills] window error:", e.error || e.message, e); } catch (_) {}
    try { setStatus("JS error: " + (e.message || "unknown")); } catch (_) {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    try { console.error("[mailbills] unhandled rejection:", e.reason); } catch (_) {}
    try { setStatus("Promise error: " + (e.reason?.message || String(e.reason))); } catch (_) {}
  });

  // ===== File helpers (Safari may give empty file.type) =====
  function isHeicLike(file) {
    const t = String(file?.type || "").toLowerCase();
    const n = String(file?.name || "").toLowerCase();
    return t.includes("heic") || t.includes("heif") || n.endsWith(".heic") || n.endsWith(".heif");
  }

  function inferContentType(file) {
    const t = String(file?.type || "").toLowerCase();
    if (t) return t;

    const n = String(file?.name || "").toLowerCase();
    if (n.endsWith(".pdf")) return "application/pdf";
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    if (n.endsWith(".webp")) return "image/webp";
    return "application/octet-stream";
  }

  function describeFile(file) {
    return `${file?.name || "upload"} (${file?.type || "unknown type"}, ${file?.size || 0} bytes)`;
  }

  // ===== OCR transport (ASYNC job start + status poll) =====

  async function startAzureOcrJob(file) {
    if (isHeicLike(file)) {
      throw new Error(
        "This photo format (HEIC/HEIF) is not supported for OCR yet. " +
        "Please upload a JPG/PNG/PDF, or change iPhone Camera settings to 'Most Compatible' (JPEG)."
      );
    }

    const ct = inferContentType(file);
    console.log("[mailbills] OCR start upload:", describeFile(file), "=> Content-Type:", ct);

    const buf = await file.arrayBuffer();
    const out = await fetchJson(URL_PARSE_START, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        "X-File-Name": encodeURIComponent(file.name || "upload"),
      },
      body: buf,
    });

    if (!out.ok) {
      const msg =
        out.json?.detail ||
        out.json?.message ||
        out.json?.error ||
        out.text ||
        `OCR start failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

    const jobId = out.json?.job_id || out.json?.jobId || out.json?.id || "";
    if (!String(jobId || "").trim()) {
      throw new Error("OCR start did not return a job_id.");
    }
    return String(jobId);
  }

  async function pollAzureOcrJob(jobId, opts = {}) {
    const {
      intervalMs = 1500,
      timeoutMs = 240000, // 4 minutes to be nicer to big PDFs
      onTick = null,
    } = opts;

    const startedAt = Date.now();

    while (true) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("OCR is taking too long. Please try again or upload a smaller/clearer document.");
      }

      const url = `${URL_PARSE_STATUS}?job_id=${encodeURIComponent(jobId)}`;
      const out = await fetchJson(url, { method: "GET" });

      if (!out.ok) {
        const msg =
          out.json?.detail ||
          out.json?.message ||
          out.json?.error ||
          out.text ||
          `OCR status failed with HTTP ${out.status}.`;
        throw new Error(String(msg));
      }

      const j = out.json || {};
      const statusRaw = j.status || j.state || "";
      const status = String(statusRaw).toLowerCase();

      if (typeof onTick === "function") {
        try { onTick(status, j); } catch (_) {}
      }

      if (status === "done") {
        const text = String(j.text || j.ocr_text || j.result?.text || "");
        if (!text.trim()) {
          throw new Error("OCR completed but returned empty text. Try a clearer photo or PDF.");
        }
        return text;
      }

      if (status === "failed" || status === "error") {
        const msg = j.error || j.message || "OCR job failed.";
        throw new Error(String(msg));
      }

      // Treat empty/unknown as still running
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async function parseAzure(file) {
    const jobId = await startAzureOcrJob(file);

    setStatus("OCR started…");
    const text = await pollAzureOcrJob(jobId, {
      intervalMs: 1500,
      timeoutMs: 240000,
      onTick: (status) => {
        if (!status || status === "running" || status === "processing") {
          setStatus("Running OCR…");
        } else {
          setStatus(`Running OCR… (${status})`);
        }
      },
    });

    return { kind: "ocr", text: String(text) };
  }

  // ===== DEMO MODE (locked bilingual) =====
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
        out.json?.error ||
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
        out.json?.error ||
        out.text ||
        `Translate failed with HTTP ${out.status}.`;
      throw new Error(String(msg));
    }

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
      data?.english_explanation ||
      data?.english_summary ||
      data?.summary ||
      data?.explanation ||
      data?.message ||
      data?.result?.english_explanation ||
      data?.result?.english_summary ||
      data?.result?.summary ||
      data?.result?.explanation ||
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

      setStatus("Starting OCR…");
      const parsed = await parseAzure(file);
      if (ocrBox()) ocrBox().value = parsed.text;

      setStatus("Generating English explanation…");
      const data = await interpretEnglish(parsed.text);

      const en = extractEnglishExplanation(data);
      if (englishBox()) englishBox().value = en;

      if (data?.spanish_explanation || data?.spanish_summary) {
        setStatus("Using mirrored Spanish…");
        const esOut = String(data?.spanish_explanation || data?.spanish_summary || "");
        if (spanishBox()) spanishBox().value = esOut;
      } else {
        setStatus("Translating explanation to Spanish…");
        const es = await translateText(en, "es");
        if (spanishBox()) spanishBox().value = String(es || "");
      }

      renderExtras(data);
      renderClarifications(data?.clarifications);

      setStatus("Done");
    } catch (err) {
      console.error("[mailbills] handleFiles error:", err);
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
      const msg = `Missing file inputs. fileInput=${!!fileInput} camInput=${!!camInput}`;
      console.error("[mailbills]", msg);
      setStatus(msg);
      return;
    }

    on(btnUpload, "click", () => {
      console.log("[mailbills] upload click");
      fileInput.click();
    });

    on(btnCamera, "click", () => {
      console.log("[mailbills] camera click");
      camInput.click();
    });

    on(fileInput, "change", (e) => {
      console.log("[mailbills] file-input change", e.target?.files?.length || 0);
      setStatus(`Selected file(s): ${e.target?.files?.length || 0}`);
      handleFiles(e.target.files);
    });

    on(camInput, "change", (e) => {
      console.log("[mailbills] camera-input change", e.target?.files?.length || 0);
      setStatus(`Captured file(s): ${e.target?.files?.length || 0}`);
      handleFiles(e.target.files);
    });

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

    console.log("[mailbills] wired");
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
