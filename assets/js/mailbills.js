(() => {
  "use strict";

  const AZURE_FUNCS_BASE =
    (window.VOY_AZURE_FUNCS_BASE ||
      "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net"
    ).replace(/\/$/, "");

  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE ||
      "https://ai-translator-i5jb.onrender.com"
    ).replace(/\/$/, "");

  const URL_UPLOAD_URL = `${AZURE_FUNCS_BASE}/api/mailbills_upload_url`;
  const URL_PARSE_START = `${AZURE_FUNCS_BASE}/api/mailbills_parse_start`;
  const URL_PARSE_STATUS = `${AZURE_FUNCS_BASE}/api/mailbills_parse_status`;
  const URL_INTERPRET = `${AI_TRANSLATOR_BASE}/api/mailbills/interpret`;

  const $ = (s) => document.querySelector(s);
  const on = (e, ev, fn) => e && e.addEventListener(ev, fn);

  function setStatus(t) {
    const el = $("#status-line");
    if (el) el.textContent = t || "";
  }

  function setBusy(b) {
    ["#btn-upload", "#btn-camera", "#mb-clear"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = !!b;
    });
  }

  function inferType(f) {
    if (f.type) return f.type;
    const n = f.name.toLowerCase();
    if (n.endsWith(".pdf")) return "application/pdf";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    if (n.endsWith(".png")) return "image/png";
    return "application/octet-stream";
  }

  async function fetchJson(url, opts) {
    const r = await fetch(url, opts);
    const t = await r.text();
    let j = null;
    try { j = JSON.parse(t); } catch {}
    return { ok: r.ok, status: r.status, json: j, text: t };
  }

  async function getUploadSession(file) {
    const r = await fetchJson(URL_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content_type: inferType(file),
      }),
    });
    if (!r.ok) throw new Error(r.text);
    return r.json;
  }

  async function uploadBlob(url, file) {
    const buf = await file.arrayBuffer();
    const r = await fetch(url, {
      method: "PUT",
      headers: {
        "x-ms-blob-type": "BlockBlob",
        "Content-Type": inferType(file),
      },
      body: buf,
    });
    if (!r.ok) throw new Error("Blob upload failed");
  }

  async function startOCR(sess) {
    const r = await fetchJson(URL_PARSE_START, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: sess.job_id,
        blob_url: sess.upload_url,
      }),
    });
    if (!r.ok) throw new Error(r.text);
    return r.json.job_id || sess.job_id;
  }

  async function pollOCR(jobId) {
    while (true) {
      const r = await fetchJson(
        `${URL_PARSE_STATUS}?job_id=${encodeURIComponent(jobId)}`
      );
      if (!r.ok) throw new Error(r.text);

      const s = (r.json.status || "").toLowerCase();
      if (s === "done") return r.json.text;
      if (s === "failed") throw new Error("OCR failed");

      setStatus("Running OCR…");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  async function handleFile(file) {
    setBusy(true);
    try {
      setStatus("Uploading…");
      const sess = await getUploadSession(file);
      await uploadBlob(sess.upload_url, file);

      setStatus("OCR processing…");
      const jobId = await startOCR(sess);
      const text = await pollOCR(jobId);
      $("#ocr-text").value = text;

      setStatus("Generating explanation…");
      const r = await fetchJson(URL_INTERPRET, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(r.text);

      const data = r.json || {};
      $("#summary-en").value =
        data.english_explanation || data.summary || "";

      $("#summary-es").value =
        data.spanish_explanation ||
        data.spanish_summary ||
        "";

      setStatus("Done");
    } catch (e) {
      console.error(e);
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  function wire() {
    on($("#btn-upload"), "click", () => $("#file-input").click());
    on($("#file-input"), "change", (e) => handleFile(e.target.files[0]));
    on($("#mb-clear"), "click", () => {
      $("#ocr-text").value = "";
      $("#summary-en").value = "";
      $("#summary-es").value = "";
      setStatus("Ready");
    });
    setStatus("Ready");
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", wire)
    : wire();
})();
