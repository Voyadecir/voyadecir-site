const TRANSLATOR_LOCAL = {
  en: {
    empty: "Please enter text to translate.",
    translating: "Translating…",
    error: "Error from server.",
    offline: "Could not reach translator server.",
    done: "Done."
  },
  es: {
    empty: "Por favor escribe un texto para traducir.",
    translating: "Traduciendo…",
    error: "Error del servidor.",
    offline: "No se pudo conectar con el traductor.",
    done: "Hecho."
  }
};

document.addEventListener("DOMContentLoaded", function () {
  // upload / camera
  const btnUpload = document.getElementById("btn-upload");
  const btnCamera = document.getElementById("btn-camera");
  const fileInput = document.getElementById("file-input");
  const cameraInput = document.getElementById("camera-input");

  if (btnUpload && fileInput) {
    btnUpload.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) alert(`File selected: ${file.name}\n(OCR will be added soon.)`);
    });
  }

  if (btnCamera && cameraInput) {
    btnCamera.addEventListener("click", () => cameraInput.click());
    cameraInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (file) alert("Photo captured! OCR translation coming soon.");
    });
  }

  // translator elements
  const source = document.getElementById("source-text");
  const target = document.getElementById("target-text");
  const runBtn = document.getElementById("translate-run"); // now in top row
  const status = document.getElementById("translator-status");
  const srcLang = document.getElementById("src-lang");
  const tgtLang = document.getElementById("tgt-lang");
  const swapBtn = document.getElementById("swap-langs");

  const API_URL = "https://ai-translator-i5jb.onrender.com/api/translate";

  if (swapBtn) {
    swapBtn.addEventListener("click", () => {
      const sVal = srcLang.value;
      const tVal = tgtLang.value;
      if (sVal === "auto") {
        srcLang.value = tVal;
        tgtLang.value = "en";
      } else {
        srcLang.value = tVal;
        tgtLang.value = sVal;
      }
    });
  }

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      const lang = window.VD_LANG || document.documentElement.lang || "en";
      const dict = TRANSLATOR_LOCAL[lang] || TRANSLATOR_LOCAL.en;

      const text = (source && source.value) ? source.value.trim() : "";
      if (!text) {
        if (status) status.textContent = dict.empty;
        return;
      }
      if (status) status.textContent = dict.translating;

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: text,
            source_lang: srcLang.value === "auto" ? null : srcLang.value,
            target_lang: tgtLang.value || "es"
          })
        });

        if (!res.ok) {
          if (status) status.textContent = dict.error;
          return;
        }

        const data = await res.json();
        if (target) {
          target.value = data.translated_text || data.translation || "(No translation returned)";
        }
        if (status) status.textContent = dict.done;
      } catch (err) {
        if (status) status.textContent = dict.offline;
      }
    });
  }
});
