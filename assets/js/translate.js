// per-language messages
const TRANSLATOR_LOCAL = {
  en: {
    empty: "Please enter text to translate.",
    translating: "Translating…",
    error: "Error from server.",
    offline: "Could not reach translator server. Showing backup.",
    done: "Done.",
    uploading: "Uploading and reading document…",
    ocr_warning: "Server received file but OCR is not set up.",
  },
  es: {
    empty: "Por favor escribe un texto para traducir.",
    translating: "Traduciendo…",
    error: "Error del servidor.",
    offline: "No se pudo conectar con el traductor. Mostrando respaldo.",
    done: "Listo.",
    uploading: "Subiendo y leyendo documento…",
    ocr_warning: "El servidor recibió el archivo pero el OCR no está configurado.",
  },
};

// !!! make sure this matches your Render backend URL
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

  // swap languages
  if (swapBtn && srcLang && tgtLang) {
    swapBtn.addEventListener("click", () => {
      const sVal = srcLang.value;
      const tVal = tgtLang.value;
      srcLang.value = tVal;
      tgtLang.value = sVal;
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

        if (!res.ok) {
          if (status) status.textContent = dict.error;
          if (fallback) fallback.style.display = "block";
          return;
        }

        const data = await res.json();
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

  // upload document → /translate-pdf
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
        const data = await res.json();

        if (data.translated_text && target) {
          target.value = data.translated_text;
          if (source && data.source_text) {
            source.value = data.source_text;
          }
          if (status) status.textContent = dict.done;
        } else if (data.warning) {
          if (status) status.textContent = dict.ocr_warning;
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

  // camera → /translate-image
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
        const data = await res.json();

        if (data.translated_text && target) {
          target.value = data.translated_text;
          if (source && data.source_text) {
            source.value = data.source_text;
          }
          if (status) status.textContent = dict.done;
        } else if (data.warning) {
          if (status) status.textContent = dict.ocr_warning;
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
