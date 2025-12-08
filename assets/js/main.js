(function () {
  const LS_KEY = "voyadecir_lang";
  const $ = (s) => document.querySelector(s);
  let currentDict = {};

  // All languages you now support
  const SUPPORTED_LANGS = ["en", "es", "pt", "fr", "zh", "hi", "ar", "bn", "ru", "ur"];

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
    const ok = SUPPORTED_LANGS.includes(lang) ? lang : "en";
    const candidates = [
      `/lang/${ok}.json`,
      `lang/${ok}.json`
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
  // Detect initial language:
  // 1) sessionStorage
  // 2) browser language -> mapped to one of SUPPORTED_LANGS
  // 3) fallback "en"
  //
  function detect() {
    try {
      const saved = sessionStorage.getItem(LS_KEY);
      if (SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (_) {
      // ignore storage errors
    }

    const raw = (navigator.language || navigator.userLanguage || "en").toLowerCase();

    // Map browser language to our codes
    if (raw.startsWith("es")) return "es";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("zh")) return "zh";   // zh-CN, zh-TW, etc.
    if (raw.startsWith("hi")) return "hi";
    if (raw.startsWith("ar")) return "ar";
    if (raw.startsWith("bn")) return "bn";
    if (raw.startsWith("ru")) return "ru";
    if (raw.startsWith("ur")) return "ur";

    // default
    return "en";
  }

  //
  // Apply dictionary to all [data-i18n] elements
  //
  async function apply(lang) {
    const dict = await loadDict(lang);
    currentDict = dict;
    window.VOY_LANGUAGE_MAP = dict;
    window.voyT = t;
    window.VD_LANG = lang;

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

    // Set <html lang="...">
    document.documentElement.setAttribute("lang", lang);

    // Update header toggle text -> neutral globe icon instead of EN | ES
    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.textContent = "🌐";
    }
  }

  async function setLang(lang) {
    const code = SUPPORTED_LANGS.includes(lang) ? lang : "en";
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
        // Read current from storage or window
        let cur = initial;
        try {
          cur = sessionStorage.getItem(LS_KEY) || window.VD_LANG || initial;
        } catch (_) {
          // ignore
        }

        const idx = SUPPORTED_LANGS.indexOf(cur);
        const next =
          idx === -1
            ? "en"
            : SUPPORTED_LANGS[(idx + 1) % SUPPORTED_LANGS.length];

        await setLang(next);
      });
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
