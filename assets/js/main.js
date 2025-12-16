/* =========================================================
   Voyadecir — main.js
   Global UI controller:
   - Language menu (always clickable, persists choice)
   - "More" menu for mobile/tablet nav option C
   - Broadcast language changes to all components
   ========================================================= */

(function () {
  const LANG_KEY = "voyadecir_lang";

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getBrowserLang() {
    const raw = (navigator.language || "en").toLowerCase();
    if (raw.startsWith("es")) return "es";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("fr")) return "fr";
    if (raw.startsWith("zh")) return "zh";
    if (raw.startsWith("hi")) return "hi";
    if (raw.startsWith("ar")) return "ar";
    if (raw.startsWith("bn")) return "bn";
    if (raw.startsWith("ru")) return "ru";
    if (raw.startsWith("ur")) return "ur";
    return "en";
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) || getBrowserLang() || "en";
  }

  function setLang(lang) {
    if (!lang) return;
    localStorage.setItem(LANG_KEY, lang);
    window.currentLang = lang;
    document.documentElement.lang = lang;

    document.dispatchEvent(new CustomEvent("voyadecir:lang-changed", { detail: { lang } }));
  }

  function closeAllMenus() {
    qsa(".lang-menu.is-open").forEach((m) => m.classList.remove("is-open"));
    qsa(".nav-more.is-open").forEach((m) => m.classList.remove("is-open"));
  }

  function initLanguageMenu() {
    const menu = qs(".lang-menu");
    if (!menu) return;

    const btn = qs(".lang-menu__button", menu);
    const list = qs(".lang-menu__list", menu);
    if (!btn || !list) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("is-open");
      closeAllMenus();
      if (!isOpen) menu.classList.add("is-open");
    });

    qsa(".lang-menu__link", menu).forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lang = b.getAttribute("data-lang");
        setLang(lang);
        menu.classList.remove("is-open");
      });
    });
  }

  function initMoreMenu() {
    const more = qs(".nav-more");
    if (!more) return;

    const btn = qs(".nav-more__button", more);
    const list = qs(".nav-more__list", more);
    if (!btn || !list) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = more.classList.contains("is-open");
      closeAllMenus();
      if (!isOpen) more.classList.add("is-open");
    });

    qsa("a", list).forEach((a) => {
      a.addEventListener("click", () => {
        more.classList.remove("is-open");
      });
    });
  }

  function initOutsideClickClose() {
    document.addEventListener("click", () => closeAllMenus());
    window.addEventListener("blur", () => closeAllMenus());
    window.addEventListener("resize", () => closeAllMenus());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllMenus();
    });
  }

  function init() {
    // Establish language at startup
    const lang = getLang();
    setLang(lang);

    initLanguageMenu();
    initMoreMenu();
    initOutsideClickClose();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
