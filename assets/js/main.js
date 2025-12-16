/* =========================================================
   Voyadecir – Main (global)
   - Language dropdown open/close + persistence
   - Dispatches lang change event for Clara and pages
   - Removes theme toggle logic (disabled by request)
   ========================================================= */

(function () {
  const STORAGE_KEY = "voyadecir_lang";

  function getPreferredLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;

    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("es")) return "es";
    if (nav.startsWith("pt")) return "pt";
    if (nav.startsWith("fr")) return "fr";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("hi")) return "hi";
    if (nav.startsWith("ar")) return "ar";
    if (nav.startsWith("bn")) return "bn";
    if (nav.startsWith("ru")) return "ru";
    if (nav.startsWith("ur")) return "ur";
    return "en";
  }

  function setLang(lang) {
    if (!lang) lang = "en";

    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    window.currentLang = lang;

    document.dispatchEvent(
      new CustomEvent("voyadecir:lang-changed", { detail: { lang } })
    );
  }

  function wireLanguageMenus() {
    const menus = document.querySelectorAll(".lang-menu");
    if (!menus.length) return;

    // Toggle open/close
    menus.forEach((menu) => {
      const btn = menu.querySelector(".lang-menu__button");
      const list = menu.querySelector(".lang-menu__list");
      if (!btn || !list) return;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // close others
        menus.forEach((m) => {
          if (m !== menu) m.classList.remove("is-open");
        });

        menu.classList.toggle("is-open");
      });

      // Each option
      menu.querySelectorAll("[data-lang]").forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.preventDefault();
          const lang = opt.getAttribute("data-lang");
          setLang(lang);
          menu.classList.remove("is-open");
        });
      });
    });

    // Click outside closes
    document.addEventListener("click", () => {
      menus.forEach((m) => m.classList.remove("is-open"));
    });

    // Escape closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menus.forEach((m) => m.classList.remove("is-open"));
    });
  }

  function injectLiquidGlassFilter() {
    // Add the SVG distortion filter once per page if it's missing
    if (document.getElementById("lg-dist")) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("style", "display:none");

    svg.innerHTML = `
      <filter id="lg-dist" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="blurred" />
        <feDisplacementMap in="SourceGraphic" in2="blurred" scale="70" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    `;

    document.body.appendChild(svg);
  }

  document.addEventListener("DOMContentLoaded", () => {
    // Language
    const initial = getPreferredLang();
    setLang(initial);
    wireLanguageMenus();

    // Glass filter for pages using it
    injectLiquidGlassFilter();
  });
})();
