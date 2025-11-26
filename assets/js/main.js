(function () {
  const LS_KEY = "voyadecir_lang";
  const $ = (s) => document.querySelector(s);
  let CURRENT_DICT = {};

  function t(key, fallback) {
    try {
      const dict = window.VD_I18N || CURRENT_DICT || {};
      if (dict && Object.prototype.hasOwnProperty.call(dict, key)) {
        return dict[key];
      }
      return fallback || key;
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
    CURRENT_DICT = dict;
    window.VD_I18N = dict;

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

    // update any ready status lines to current locale
    const statusLine = document.querySelector("#status-line");
    if (statusLine && statusLine.textContent) {
      const cur = statusLine.textContent.trim().toLowerCase();
      const readyVariants = ["ready", "ready.", "listo", "listo."];
      if (readyVariants.includes(cur)) {
        statusLine.textContent = t("mb.status.ready", statusLine.textContent);
      }
    }
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

  window.VD_T = t;
  window.addEventListener("DOMContentLoaded", init);
})();
