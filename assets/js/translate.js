// per-language messages
const TRANSLATOR_LOCAL = {
  en: {
    empty: "Please enter text to translate.",
    translating: "Translating…",
    error: "Error from server.",
    offline: "Could not reach translator server. Showing backup.",
    done: "Done.",
    uploading: "Uploading and reading…",
    ocr_warning: "Server received file but OCR is not set up yet.",
  },
  es: {
    empty: "Por favor escribe un texto para traducir.",
    translating: "Traduciendo…",
    error: "Error del servidor.",
    offline: "No se pudo conectar con el traductor. Mostrando respaldo.",
    done: "Listo.",
    uploading: "Subiendo y leyendo…",
    ocr_warning: "El servidor recibió el archivo pero el OCR aún no está activo.",
  },
};

// <<< make sure this matches your translator service on Render
const API_BASE = "https://ai-translator-i5jb.onrender.com";

const TRANSLATOR_API = `${API_BASE}/api/translate`;
const PDF_API = `${API_BASE}/translate-pdf`;
const IMAGE_API = `${API_BASE}/translate-image`;

document.addEventListener("DOMContentLoaded", function () {
  const source = document.getElementById("source-text");
  const target = document.getElementById("target-text");
  const runBtn = document.getElementById("translate-run");
  const status = document.getElementById("translator-status");
  const srcLang = document.getElementById("src-lang");
  const tgtLang = document.getElementById("tgt-lang");
  const swapBtn = document.getElementById("swap-langs");
  const fallback = document.getElementById("iframe-fallback");

  const btnUpload = document.getElementById("btn-upload");
  const btnCamera = document.getElementById("btn-camera");
  const fileInput = document.getElementById("file-input");
  const cameraInput = document.getElementById("camera-input");

  function currentLangDict() {
    const lang = window.VD_LANG || document.documentElement.lang || "en";
    return TRANSLATOR_LOCAL[lang] || TRANSLATOR_LOCAL.en;
  }

  // swap From/To
  if (swapBtn && srcLang && tgtLang) {
    swapBtn.addEventListener("click", () => {
      const s = srcLang.value;
      const t = tgtLang.value;
      srcLang.value = t;
      tgtLang.value = s;
    });
  }

  // text translate
  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      const dict = currentLangDict();
      const text = (source && source.value) ? source.value.trim() : "";
      if (!text) {
        if (status) status.textContent = dict.empty;
        return;
      }
      if (status) status.textContent = dict.translating;

      try {
        const res = await fetch(TRANSLATOR_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            target_lang: tgtLang ? tgtLang.value : "es",
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (status) status.textContent = data.error || dict.error;
          if (fallback) fallback.style.display = "block";
          return;
        }

        if (target) {
          target.value =
            data.translated_text ||
            data.translation ||
            "(No translation returned)";
        }
        if (status) status.textContent = dict.done;
      } catch (err) {
        if (status) status.textContent = dict.offline;
        if (fallback) fallback.style.display = "block";
      }
    });
  }

  // upload PDF/doc
  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", async (e) => {
      const dict = currentLangDict();
      const file = e.target.files[0];
      if (!file) return;

      if (status) status.textContent = dict.uploading;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_lang", tgtLang ? tgtLang.value : "es");

      try {
        const res = await fetch(PDF_API, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        if (data.translated_text && target) {
          target.value = data.translated_text;
          if (source && data.source_text) source.value = data.source_text;
          if (status) status.textContent = dict.done;
        } else if (data.warning) {
          if (status) status.textContent = data.warning;
        } else {
          if (status) status.textContent = dict.error;
        }
      } catch (err) {
        if (status) status.textContent = dict.error;
      } finally {
        fileInput.value = "";
      }
    });
  }

  // image / camera
  if (btnCamera && cameraInput) {
    btnCamera.addEventListener("click", () => cameraInput.click());

    cameraInput.addEventListener("change", async (e) => {
      const dict = currentLangDict();
      const file = e.target.files[0];
      if (!file) return;

      if (status) status.textContent = dict.uploading;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_lang", tgtLang ? tgtLang.value : "es");

      try {
        const res = await fetch(IMAGE_API, {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));

        // even if the server replies 500, try to show what it said
        if (!res.ok) {
          if (status) status.textContent = data.error || data.warning || dict.error;
          return;
        }

        if (data.translated_text && target) {
          target.value = data.translated_text;
          if (source && data.source_text) source.value = data.source_text;
          if (status) status.textContent = dict.done;
        } else if (data.warning) {
          if (status) status.textContent = data.warning;
        } else {
          if (status) status.textContent = dict.error;
        }
      } catch (err) {
        if (status) status.textContent = dict.error;
      } finally {
        cameraInput.value = "";
      }
    });
  }
});
