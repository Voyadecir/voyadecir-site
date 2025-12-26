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
    if (el) el.textContent = String(msg ?? "");
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

  // ===== File type control =====
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

  // Option C: text-like files (skip OCR; still interpret/translate + PDF export)
  const TEXT_EXT = new Set(["txt", "md", "log", "csv", "tsv", "json", "xml", "yaml", "yml"]);
  const TEXT_MIME_EXACT = new Set(["text/plain", "application/json", "application/xml"]);
  const TEXT_MIME_PREFIXES = ["text/"];

  // Explicitly blocked dangerous/irrelevant uploads
  const BLOCKED_EXT = new Set(["exe", "msi", "apk", "zip", "rar", "7z"]);

  function extOf(name) {
    const n = (name || "").toLowerCase();
    const idx = n.lastIndexOf(".");
    return idx >= 0 ? n.slice(idx + 1) : "";
  }

  function guessMime(file) {
    const tt = (file?.type || "").toLowerCase();
    if (tt) return tt;

    const ext = extOf(file?.name || "");
    if (ext === "pdf") return "application/pdf";
    if (ext === "png") return "image/png";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "tif" || ext === "tiff") return "image/tiff";
    if (ext === "webp") return "image/webp";
    if (ext === "heic") return "image/heic";
    if (ext === "heif") return "image/heif";
    if (ext && TEXT_EXT.has(ext)) return "text/plain";
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

  function isTextFile(file) {
    const ext = extOf(file?.name || "");
    const mime = guessMime(file);
    if (ext && TEXT_EXT.has(ext)) return true;
    if (TEXT_MIME_EXACT.has(mime)) return true;
    return TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p));
  }

  // Sniff common types from magic bytes (fixes Android Edge camera files with empty type/extension).
  function sniffMimeFromBytes(buf) {
    try {
      const u = new Uint8Array(buf);
      if (u.length >= 4) {
        // PDF: 25 50 44 46 = %PDF
        if (u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46) return "application/pdf";
        // JPEG: FF D8 FF
        if (u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF) return "image/jpeg";
        // PNG: 89 50 4E 47
        if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4E && u[3] === 0x47) return "image/png";
        // TIFF: II*\0 or MM\0*
        if ((u[0] === 0x49 && u[1] === 0x49 && u[2] === 0x2A && u[3] === 0x00) ||
            (u[0] === 0x4D && u[1] === 0x4D && u[2] === 0x00 && u[3] === 0x2A)) return "image/tiff";
      }
      // WEBP: "RIFF" .... "WEBP"
      if (u.length >= 12) {
        const riff = String.fromCharCode(u[0], u[1], u[2], u[3]);
        const webp = String.fromCharCode(u[8], u[9], u[10], u[11]);
        if (riff === "RIFF" && webp === "WEBP") return "image/webp";
      }
    } catch (_) {}
    return "";
  }

  function isAllowedBinaryForOCR(file) {
    const name = file?.name || "";
    const ext = extOf(name);
    const mime = guessMime(file);

    if (ext && BLOCKED_EXT.has(ext)) return false;

    // Normal allow: known extension or known mime
    if ((ext && ALLOWED_EXT.has(ext)) || (mime && ALLOWED_MIME.has(mime))) return true;

    // Android camera capture edge case (type="" and no extension)
    const looksLikeUnknownButProbablyBinary =
      (!mime || mime === "application/octet-stream") &&
      (!ext || ext.length === 0) &&
      typeof file?.size === "number" &&
      file.size > 0;

    if (looksLikeUnknownButProbablyBinary) return true;

    return false;
  }

  // Best-effort: convert HEIC/HEIF/WebP to JPEG in-browser (some browsers support decode, some don’t).
  async function normalizeImageIfNeeded(file) {
    const mime = guessMime(file);

    const needsConvert =
      mime === "image/heic" || mime === "image/heif" || mime === "image/webp";

    if (!needsConvert) return file;

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

  async function readTextFromFile(file) {
    try {
      if (typeof file?.text === "function") {
        return await file.text();
      }
    } catch (_) {}
    return await new Promise((resolve, reject) => {
      try {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("Could not read the text file."));
        r.readAsText(file);
      } catch (e) {
        reject(e);
      }
    });
  }

  // ===== Clara bridge (assistant.js should listen for this) =====
  function emitAssistantMessage(role, text) {
    const msg = String(text ?? "");
    try {
      window.dispatchEvent(new CustomEvent("voyadecir:assistant-message", {
        detail: { role: role || "assistant", text: msg }
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  // Fallback: if some older Clara DOM exists, append there.
  function pushClaraFallback(role, text) {
    try {
      const body = document.querySelector("#clara-body");
      if (!body) return false;
      const div = document.createElement("div");
      div.className = `clara-msg ${role || "assistant"}`;
      div.style.whiteSpace = "pre-wrap";
      div.textContent = String(text || "");
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
      return true;
    } catch (_) {
      return false;
    }
  }

  function pushClara(role, text) {
    // Prefer assistant event (new system)
    if (emitAssistantMessage(role, text)) return true;
    // Fallback to DOM if assistant not listening
    return pushClaraFallback(role, text);
  }

  async function parseAzure(file) {
    debugFile(file, "UPLOAD");

    // Option C: text files skip OCR
    if (isTextFile(file)) {
      const txt = await readTextFromFile(file);
      const cleaned = String(txt || "").trim();
      if (!cleaned) throw new Error("That file looks empty.");
      return { kind: "text", text: cleaned };
    }

    const normalized = await normalizeImageIfNeeded(file);
    debugFile(normalized, "NORMALIZED");

    if (!isAllowedBinaryForOCR(normalized)) {
      throw new Error("Unsupported file. Upload a photo/PDF — or a .txt/.csv/.json file for direct translation.");
    }

    const bytes = await normalized.arrayBuffer();

    // Force a correct content type for Android Edge camera captures
    let ct = guessMime(normalized);
    if (!ct || ct === "application/octet-stream") {
      const sniffed = sniffMimeFromBytes(bytes);
      if (sniffed) ct = sniffed;
    }
    if (!ct || ct === "application/octet-stream") {
      ct = "image/jpeg";
    }

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

    return { kind: "ocr", text: String(text) };
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

  function renderClarifications(list) {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) {
      const wrap = document.getElementById("clarification-section");
      if (wrap) wrap.style.display = "none";
      return;
    }

    const bullets = items
      .map((item) => item?.prompt || item?.question || item?.word || "")
      .map((s) => String(s || "").trim())
      .filter(Boolean);

    const claraText =
      `${t("mb.clarifications.title", "Clara: Quick question so I translate this the right way—")}\n` +
      bullets.map((q) => `• ${q}`).join("\n");

    const pushed = pushClara("assistant", claraText);

    // Fallback: show in-page list if Clara panel isn’t available / isn’t listening.
    const wrap = document.getElementById("clarification-section");
    const ul = document.getElementById("clarification-list");
    if (!wrap || !ul) return;

    ul.innerHTML = "";
    if (pushed) {
      wrap.style.display = "none";
      setStatus(t("mb.clarifications.sent", "Clara asked a couple questions in the chat."));
      return;
    }

    bullets.forEach((q) => {
      const li = document.createElement("li");
      li.textContent = q;
      ul.appendChild(li);
    });

    wrap.style.display = "block";
    setStatus(t("mb.clarifications", "We found possible ambiguities. Please clarify:"));
  }

  async function handleFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    setBusy(true);
    enablePdf(false);
    setStatus(t("mb.status.reading", "Reading document…"));

    try {
      const file = list[0];

      setStatus(t("mb.status.ocr", "Reading…"));
      const parsed = await parseAzure(file);

      if (ocrBox()) ocrBox().value = parsed.text;

      setStatus(t("mb.status.interpreting", "Clara is translating and explaining…"));
      const data = await interpretAgent(parsed.text, getTargetLang());
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
        const tt = await res.text().catch(() => "");
        throw new Error(tt || `PDF export failed with HTTP ${res.status}.`);
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

    if (!fileInput || !camInput) {
      console.warn("Voyadecir mailbills: missing file inputs.");
      return;
    }

    const clickFile = () => fileInput.click();
    const clickCam = () => camInput.click();

    // Mobile browsers can be picky. Use click + pointerup (no preventDefault) to avoid blocking the picker.
    on(btnUpload, "click", clickFile);
    on(btnUpload, "pointerup", clickFile);

    on(btnCamera, "click", clickCam);
    on(btnCamera, "pointerup", clickCam);

    on(fileInput, "change", (e) => handleFiles(e.target.files));
    on(camInput, "change", (e) => handleFiles(e.target.files));

    // Keep button but it’s now just a re-run
    on(btnTranslate, "click", async () => {
      const text = ocrBox()?.value || "";
      if (!text.trim()) return setStatus(t("mb.status.needs_upload", "Upload a document first."));

      setBusy(true);
      enablePdf(false);
      setStatus(t("mb.status.interpreting", "Clara is translating and explaining…"));
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

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", wire);
    } else {
      wire();
    }
  } catch (e) {
    console.error("Voyadecir mailbills failed to initialize:", e);
  }

  window.addEventListener("voyadecir:lang-change", () => {
    setStatus(t("mb.status.ready", "Ready"));
  });
})();
