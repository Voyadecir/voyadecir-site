(function () {
  const LS_KEY = "voyadecir_lang";
  const I18N_BASE = "/lang"; // your folder: /lang/en.json, /lang/es.json
  const $ = (s) => document.querySelector(s);
  let currentDict = {};

  // Global translator: window.voyT(key, fallback)
  function t(key, fallback) {
    try {
      const dict = window.VOY_LANGUAGE_MAP || currentDict || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key];
      }
    } catch (_) {
      // ignore, fall through
    }
    return fallback || key;
  }

  async function loadDict(lang) {
    const code = ["en", "es"].includes(lang) ? lang : "en";
    const url = `${I18N_BASE}/${code}.json`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.error("[i18n] failed to load", url, res.status);
        return {};
      }
      return await res.json();
    } catch (err) {
      console.error("[i18n] error loading", url, err);
      return {};
    }
  }

  function detect() {
    // 1) sessionStorage
    try {
      const saved = sessionStorage.getItem(LS_KEY);
      if (saved === "en" || saved === "es") return saved;
    } catch (_) {
      // ignore
    }

    // 2) browser language
    const nav = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    return nav.startsWith("es") ? "es" : "en";
  }

  async function apply(lang) {
    const dict = await loadDict(lang);
    currentDict = dict;
    window.VOY_LANGUAGE_MAP = dict;
    window.voyT = t;

    // Swap all [data-i18n] texts
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;

      const value = t(key, null);
      if (!value) return;

      // Don't nuke labels that wrap form controls
      if (el.querySelector("select, input, textarea")) {
        return;
      }

      el.textContent = value;
    });

    // <html lang="...">
    document.documentElement.setAttribute("lang", lang);

    // Header toggle
    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.textContent = lang === "es" ? "ES | EN" : "EN | ES";
    }

    // Expose for other scripts (translate.js, mailbills.js)
    window.VD_LANG = lang;
  }

  async function setLang(lang) {
    const code = lang === "es" ? "es" : "en";
    try {
      sessionStorage.setItem(LS_KEY, code);
    } catch (_) {
      // ignore storage failures
    }
    await apply(code);
  }

  async function init() {
    const initial = detect();
    await setLang(initial);

    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", async () => {
        let current = initial;
        try {
          current = sessionStorage.getItem(LS_KEY) || initial;
        } catch (_) {
          // ignore
        }
        const next = current === "es" ? "en" : "es";
        await setLang(next);
      });
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
