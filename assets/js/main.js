(function () {
  const LS_KEY = "voyadecir_lang";
  const $ = (s) => document.querySelector(s);
  let currentDict = {};

  function t(key, fallback) {
    try {
      const dict = window.VOY_LANGUAGE_MAP || currentDict || {};
      return dict[key] || fallback || key;
    } catch (_) {
      return fallback || key;
    }
  }

  async function loadDict(lang) {
    const ok = ["en", "es"].includes(lang) ? lang : "en";
    const res = await fetch(`/lang/${ok}.json`);
    return res.json();
  }

  function detect() {
    const saved = sessionStorage.getItem(LS_KEY);
    if (saved) return saved;
    const nav = navigator.language || navigator.userLanguage || "en";
    return nav.toLowerCase().startsWith("es") ? "es" : "en";
  }

  async function apply(lang) {
    const dict = await loadDict(lang);
    currentDict = dict;
    window.VOY_LANGUAGE_MAP = dict;
    window.voyT = t;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!dict[key]) return;

      // 👇 important: don't wipe out labels that contain form controls
      if (el.querySelector("select, input, textarea")) {
        // you could set a child span here if you wanted,
        // but for now we just leave it alone
        return;
      }

      el.textContent = dict[key];
    });

    // set <html lang="...">
    document.documentElement.setAttribute("lang", lang);

    // update toggle button text
    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.textContent = lang === "es" ? "ES | EN" : "EN | ES";
    }

    // expose current lang for other scripts (translate.js uses this)
    window.VD_LANG = lang;
  }

  async function init() {
    const lang = detect();
    sessionStorage.setItem(LS_KEY, lang);
    await apply(lang);

    const toggle = $("#lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", async function () {
        const cur = sessionStorage.getItem(LS_KEY) || "en";
        const next = cur === "en" ? "es" : "en";
        sessionStorage.setItem(LS_KEY, next);
        await apply(next);
      });
    }
  }

  window.addEventListener("DOMContentLoaded", init);
})();
