(function () {
  const LS_KEY = "voyadecir_lang";
  const $ = (s) => document.querySelector(s);
  let currentDict = {};

  //
  // Global translator helper: window.voyT(key, fallback)
  //
  function t(key, fallback) {
    try {
      const dict = window.VOY_LANGUAGE_MAP || currentDict || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key];
      }
    } catch (_) {
      // ignore and fall through
    }
    return fallback || key;
  }

  //
  // Helper: fetch JSON safely, return null on failure
  //
  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error("[i18n] Failed to load", url, res.status);
        return null;
      }
      const data = await res.json();
      // sanity check: must be an object with at least 1 key
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        console.error("[i18n] Bad JSON shape from", url);
        return null;
      }
      return data;
    } catch (err) {
      console.error("[i18n] Error loading", url, err);
      return null;
    }
  }

  //
  // Load language JSON: try /lang/... and lang/...
  //
  async function loadDict(lang) {
    const ok = ["en", "es"].includes(lang) ? lang : "en";
    const candidates = [
      `/lang/${ok}.json`,
      `lang/${ok}.json`,
    ];

    for (const url of candidates) {
      const data = await fetchJsonSafe(url);
      if (data) {
        console.info("[i18n] Loaded dictionary from", url);
        return data;
      }
    }

    console.warn("[i18n] No dictionary loaded for", ok, "– falling back to hardcoded text.");
    return {};
  }

  //
  // Detect initial language: sessionStorage -> browser language
  //
  function detect() {
    try {
      const saved = sessionStorage.getItem(LS_KEY);
      if (saved === "en" || saved === "es") return saved;
    } catch (_) {
      // ignore storage errors
    }

    const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    return nav.startsWith("es") ? "es" : "en";
  }

  //
  // Apply dictionary to all [data-i18n] + [data-i18n-placeholder]
  //
  async function apply(lang) {
    const dict = await loadDict(lang);
    currentDict = dict;
    window.VOY_LANGUAGE_MAP = dict;
    window.voyT = t;

    // 1) Text content for elements with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;

      // Only touch elements if the dict actually has that key
      if (!Object.prototype.hasOwnProperty.call(dict, key)) {
        return;
      }

      // Do not wipe labels that contain form controls; those are handled manually
      if (el.querySelector("select, input, textarea")) {
        return;
      }

      el.textContent = dict[key];
    });

    // 2) Placeholders for inputs / textareas with data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(dict, key)) {
        return;
      }
      if (el.placeholder !== undefined) {
        el.placeholder = dict[key];
      }
    });

    // Set <html lang="...">
    document.documentElement.setAttribute("lang", lang);

    // Update header toggle text
    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.textContent = lang === "es" ? "ES | EN" : "EN | ES";
    }

    // Expose for other scripts (translate.js, mailbills.js)
    window.VD_LANG = lang;

    // If Mail & Bills is loaded, let it update its labels too
    try {
      if (typeof window.updateFieldLabels === "function") {
        window.updateFieldLabels();
      }
    } catch (_) {
      // ignore if not present or fails
    }
  }

  async function setLang(lang) {
    const code = lang === "es" ? "es" : "en";
    try {
      sessionStorage.setItem(LS_KEY, code);
    } catch (_) {
      // ignore
    }
    await apply(code);
  }

  //
  // Init on page load
  //
  async function init() {
    const initial = detect();
    await setLang(initial);

    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", async () => {
        let cur = initial;
        try {
          cur = sessionStorage.getItem(LS_KEY) || initial;
        } catch (_) {
          // ignore
        }
        const next = cur === "es" ? "en" : "es";
        await setLang(next);
      });
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
