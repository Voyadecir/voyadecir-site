(() => {
  "use strict";

  // ===== Endpoints (unchanged) =====
  const AZURE_FUNCS_BASE =
    (window.VOY_AZURE_FUNCS_BASE ||
      "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net"
    ).replace(/\/$/, "");

  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com"
    ).replace(/\/$/, "");

  const URL_PARSE = `${AZURE_FUNCS_BASE}/api/mailbills/parse`;
  const URL_INTERPRET = `${AI_TRANSLATOR_BASE}/api/mailbills/interpret`;
  const URL_TRANSLATE_PDF = `${AI_TRANSLATOR_BASE}/api/mailbills/translate-pdf`;

  // ===== Helpers =====
  const $ = (sel) => document.querySelector(sel);
  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
  const t = (key, fallback = "") => {
    if (window.VOY_I18N?.t) return window.VOY_I18N.t(key, fallback);
    return fallback || key;
  };

  function uiLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  function setStatus(msg) {
    const el = $("#status-line");
    if (el) el.textContent = msg;
  }

  function setBusy(isBusy) {
    ["#btn-upload", "#btn-camera", "#mb-translate-btn", "#mb-clear", "#mb-download-pdf"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!isBusy;
    });
  }

  function enablePdf(enabled) {
    const b = $("#mb-download-pdf");
    if (b) b.disabled = !enabled;
  }

  function getTargetLang() {
    const sel = $("#target-lang") || $("#mb-tgt-lang");
    return sel ? sel.value : "es";
  }

  function getFileInput() { return $("#file-input"); }
  function getCamInput() { return $("#camera-input"); }
  function ocrBox() { return $("#ocr-text"); }
  function summaryBox() { return $("#summary-text"); }

  // ===== File type control (fixes 415) =====
  const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "tif", "tiff", "webp", "heic", "heif"]);
  const ALLOWED_MIME = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/tiff",
    "image/webp",
    "image/heic",
    "image/heif",
  ]);

  // Explicitly blocked “document” types users might try to upload.
  // (We block these even if a browser gives a weird/empty MIME.)
  const BLOCKED_EXT = new Set([
    "txt", "doc", "docx", "rtf", "odt", "pages",
    "xls", "xlsx", "csv",
    "ppt", "pptx",
    "zip", "rar", "7z",
    "exe"
  ]);

  function extOf(name) {
    const n = (name || "").toLowerCase();
    const idx = n.lastIndexOf(".");
    return idx >= 0 ? n.slice(idx + 1) : "";
  }

  function guessMime(file) {
    const t = (file?.type || "").toLowerCase();
    if (t) return t;

    const ext = extOf(file?.name || "");
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "tif" || ext === "tiff") return "image/tiff";
    if (ext === "webp") return "image/webp";
    if (ext === "heic") return "image/heic";
    if (ext === "heif") return "image/heif";
    return "application/octet-stream";
  }

  function debugFile(file, label = "FILE") {
    try {
      console.log(`${label} DEBUG:`, {
        name: file?.name,
        type: file?.type,
        size: file?.size,
        ext: extOf(file?.name || ""),
        guessedMime: guessMime(file),
        lastModified: file?.lastModified,
      });
    } catch (_) {}
  }

  function isAllowed(file) {
    const name = file?.name || "";
    const ext = extOf(name);
    const mime = guessMime(file);

    // Hard block obvious non-photo docs (like .txt)
    if (ext && BLOCKED_EXT.has(ext)) return false;

    // Normal allow: known extension or known mime
    if ((ext && ALLOWED_EXT.has(ext)) || (mime && ALLOWED_MIME.has(mime))) return true;

    // Android camera capture edge case:
    // Some browsers provide file.type="" and a name with no extension.
    // If it came from our camera/file input, it’s still a real image blob.
    // We accept it unless it clearly looks like a document.
    const looksLikeUnknownButProbablyImage =
      (!mime || mime === "application/octet-stream") &&
      (!ext || ext.length === 0) &&
      typeof file?.size === "number" &&
      file.size > 0;

    if (looksLikeUnknownButProbablyImage) return true;

    return false;
  }

  // Best-effort: convert HEIC/HEIF/WebP to JPEG in-browser (some browsers support decode, some don’t).
  async function normalizeImageIfNeeded(file) {
    const mime = guessMime(file);

    const needsConvert =
      mime === "image/heic" || mime === "image/heif" || mime === "image/webp";

    if (!needsConvert) return file;

    // Try decoding to canvas, then export JPEG.
    try {
      const blobUrl = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = "async";
      const loaded = new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error("Image decode failed"));
      });
      img.src = blobUrl;
      await loaded;

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const jpegBlob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );

      URL.revokeObjectURL(blobUrl);

      if (!jpegBlob) return file;

      const newName =
        (file.name || "upload").replace(/\.(heic|heif|webp)$/i, "") + ".jpg";
      return new File([jpegBlob], newName, { type: "image/jpeg" });
    } catch (_) {
      // If conversion fails, keep original and let backend decide.
      return file;
    }
  }

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    let text = "";
    try { text = await res.text(); } catch (_) {}
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { ok: res.ok, status: res.status, json, text };
  }

  async function parseAzure(file) {
    debugFile(file, "UPLOAD");

    const normalized = await normalizeImageIfNeeded(file);
    debugFile(normalized, "NORMALIZED");

    // Block garbage before Azure sees it (fixes your .txt test)
    if (!isAllowed(normalized)) {
      throw new Error("Unsupported file. Upload a photo (camera image) or a PDF.");
    }

    const ct = guessMime(normalized);

    const bytes = await normalized.arrayBuffer();
    const out = await fetchJson(URL_PARSE, {
      method: "POST",
      headers: {
        "Content-Type": ct,
        "X-Voyadecir-Lang": uiLang(),
      },
      body: bytes,
    });

    if (!out.ok) {
      const msg =
        out.json?.message ||
        out.json?.error ||
        out.text ||
        `Analyze call failed with HTTP ${out.status}.`;
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

    return String(text);
  }

  async function interpretAgent(text, targetLang) {
    const out = await fetchJson(URL_INTERPRET, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_lang: targetLang,
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

  function render(data) {
    const sb = summaryBox();
    if (sb) {
      const summary =
        data.summary ||
        data.explanation ||
        data.message ||
        data.result?.summary ||
        data.result?.explanation ||
        "";
      sb.value = String(summary || "");
    }

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

  // ===== Clarifications: make Clara sound human + clean bullets =====
  function niceLangName(code) {
    const map = { en: "English", es: "Spanish", fr: "French", pt: "Portuguese", zh: "Chinese" };
    return map[code] || code || "";
  }

  function normalizeMeaning(m) {
    if (!m) return null;
    const type = String(m.type || "").trim();
    const translation = String(m.translation || "").trim();
    const definition = String(m.definition || "").trim();
    const example = Array.isArray(m.examples_source) ? m.examples_source[0] : (m.examples_source || "");
    return {
      type,
      translation,
      definition,
      example: String(example || "").trim(),
    };
  }

  function renderClarifications(list) {
    const wrap = document.getElementById("clarification-section");
    const ul = document.getElementById("clarification-list");
    if (!wrap || !ul) return;

    ul.innerHTML = "";
    if (!Array.isArray(list) || list.length === 0) {
      wrap.style.display = "none";
      return;
    }

    // Clara-style intro (uses status line unless you add #clarification-intro in HTML)
    const intro = document.getElementById("clarification-intro");
    const introText = t(
      "mb.clarifications_intro",
      "Clara here. Quick question so I translate this correctly:"
    );
    if (intro) intro.textContent = introText;
    setStatus(introText);

    list.forEach((item) => {
      const li = document.createElement("li");

      const word = String(item?.word || item?.token || "").trim();
      const src = String(item?.source_language || item?.source_lang || item?.source || "").trim();
      const tgt = String(item?.target_language || item?.target_lang || item?.target || getTargetLang()).trim();

      const meaningsRaw =
        item?.meanings?.meanings || item?.meanings || item?.options || item?.senses || [];

      const meanings = Array.isArray(meaningsRaw)
        ? meaningsRaw.map(normalizeMeaning).filter(Boolean)
        : [];

      const srcName = niceLangName(src) || "the original";
      const tgtName = niceLangName(tgt) || "the translation";

      // Main question line
      const qEl = document.createElement("div");
      qEl.className = "clarification-question";
      qEl.textContent = word
        ? `When you say “${word}” in ${srcName}, which meaning do you mean?`
        : "Which meaning do you mean here?";
      li.appendChild(qEl);

      // Options as sub-bullets
      if (meanings.length) {
        const sub = document.createElement("ul");
        sub.className = "clarification-options";

        meanings.slice(0, 6).forEach((m) => {
          const opt = document.createElement("li");

          const parts = [];
          if (m.translation) parts.push(`“${m.translation}”`);
          if (m.type) parts.push(m.type);
          if (m.definition) parts.push(m.definition);

          opt.textContent = parts.filter(Boolean).join(" • ") || "Option";

          if (m.example) {
            const ex = document.createElement("div");
            ex.className = "clarification-example";
            ex.textContent = `Example: ${m.example}`;
            opt.appendChild(ex);
          }

          sub.appendChild(opt);
        });

        li.appendChild(sub);

        const hint = document.createElement("div");
        hint.className = "clarification-hint";
        hint.textContent = `Reply with the one you mean, and I’ll translate it into ${tgtName}.`;
        li.appendChild(hint);
      } else {
        // Fallback if backend gave only a simple prompt/question
        const question = String(item?.prompt || item?.question || "").trim();
        if (question) {
          const p = document.createElement("div");
          p.className = "clarification-question";
          p.textContent = question;
          li.appendChild(p);
        }
      }

      ul.appendChild(li);
    });

    wrap.style.display = "block";
  }

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    setBusy(true);
    enablePdf(false);
    setStatus(t("mb.status.reading", "Reading document…"));

    try {
      const file = list[0];

      setStatus(t("mb.status.ocr", "Running OCR…"));
      const text = await parseAzure(file);
      if (ocrBox()) ocrBox().value = text;

      setStatus(t("mb.status.interpreting", "Explaining and translating…"));
      const data = await interpretAgent(text, getTargetLang());
      render(data);
      renderClarifications(data?.clarifications);

      enablePdf(true);
      setStatus(t("mb.status.done", "Done"));
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

  async function downloadPdf() {
    const text = ocrBox()?.value || "";
    const summary = summaryBox()?.value || "";
    if (!text.trim()) return setStatus(t("mb.status.no_text", "No text to export yet."));

    setBusy(true);
    setStatus(t("mb.status.building_pdf", "Building PDF…"));

    try {
      const res = await fetch(URL_TRANSLATE_PDF, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          summary,
          target_lang: getTargetLang(),
          ui_lang: uiLang(),
        }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `PDF export failed with HTTP ${res.status}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "voyadecir-translation.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      setStatus(t("mb.status.done", "Done"));
    } catch (err) {
      setStatus(err?.message ? err.message : "PDF export failed.");
    } finally {
      setBusy(false);
    }
  }

  function wire() {
    const btnUpload = $("#btn-upload");
    const btnCamera = $("#btn-camera");
    const btnClear = $("#mb-clear");
    const btnTranslate = $("#mb-translate-btn");
    const btnPdf = $("#mb-download-pdf");

    const fileInput = getFileInput();
    const camInput = getCamInput();

    const clickFile = () => fileInput && fileInput.click();
    const clickCam = () => camInput && camInput.click();

    on(btnUpload, "click", clickFile);
    on(btnUpload, "touchstart", (e) => { e.preventDefault(); clickFile(); }, { passive: false });

    on(btnCamera, "click", clickCam);
    on(btnCamera, "touchstart", (e) => { e.preventDefault(); clickCam(); }, { passive: false });

    on(fileInput, "change", (e) => handleFiles(e.target.files));
    on(camInput, "change", (e) => handleFiles(e.target.files));

    // Keep button but it’s now just a re-run
    on(btnTranslate, "click", async () => {
      const text = ocrBox()?.value || "";
      if (!text.trim()) return setStatus(t("mb.status.needs_upload", "Upload a document first."));

      setBusy(true);
      enablePdf(false);
      setStatus(t("mb.status.interpreting", "Explaining and translating…"));
      try {
        const data = await interpretAgent(text, getTargetLang());
        render(data);
        renderClarifications(data?.clarifications);
        enablePdf(true);
        setStatus(t("mb.status.done", "Done"));
      } catch (err) {
        setStatus(err?.message ? err.message : "Interpret failed.");
      } finally {
        setBusy(false);
      }
    });

    on(btnClear, "click", () => {
      if (ocrBox()) ocrBox().value = "";
      if (summaryBox()) summaryBox().value = "";
      enablePdf(false);
      setStatus(t("mb.status.ready", "Ready"));
      ["identity-section", "payment-section", "other-amounts-section", "clarification-section"].forEach((id) => {
        const sec = document.getElementById(id);
        if (sec) sec.style.display = "none";
      });
    });

    on($("#mb-copy-text") || $("#mb-copy-ocr"), "click", () => {
      const v = ocrBox()?.value || "";
      if (v) navigator.clipboard?.writeText(v).catch(() => {});
    });
    on($("#mb-copy-summary"), "click", () => {
      const v = summaryBox()?.value || "";
      if (v) navigator.clipboard?.writeText(v).catch(() => {});
    });

    on(btnPdf, "click", downloadPdf);

    enablePdf(false);
    setStatus(t("mb.status.ready", "Ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  window.addEventListener("voyadecir:lang-change", () => {
    setStatus(t("mb.status.ready", "Ready"));
  });
})();
