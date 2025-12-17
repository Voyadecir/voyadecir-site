(function () {
  const LS_KEY = "voyadecir_lang";
  const SUPPORTED_LANGS = ["en", "es", "pt", "fr", "zh", "hi", "ar", "bn", "ru", "ur"];

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  let currentDict = {};

  function t(key, fallback) {
    try {
      const dict = window.VOY_LANGUAGE_MAP || currentDict || {};
      if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    } catch (_) {}
    return fallback || key;
  }

  async function fetchJsonSafe(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function loadDict(lang) {
    const ok = SUPPORTED_LANGS.includes(lang) ? lang : "en";
    const candidates = [`/lang/${ok}.json`, `lang/${ok}.json`];

    for (const url of candidates) {
      const data = await fetchJsonSafe(url);
      if (data) return data;
    }
    return {};
  }

  function detect() {
    try {
      const saved = sessionStorage.getItem(LS_KEY);
      if (SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (_) {}

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

  async function apply(lang) {
    const dict = await loadDict(lang);
    currentDict = dict;
    window.VOY_LANGUAGE_MAP = dict;
    window.voyT = t;
    window.VD_LANG = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(dict, key)) return;

      if (el.querySelector("select, input, textarea")) return;
      el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(dict, key)) return;
      el.setAttribute("placeholder", dict[key]);
    });

    document.documentElement.setAttribute("lang", lang);

    $$(".lang-menu__link, .js-lang-option").forEach((btn) => {
      const code = btn.getAttribute("data-lang");
      btn.classList.toggle("is-active", code === lang);
    });

    try {
      window.dispatchEvent(new CustomEvent("voyadecir:lang-changed", { detail: { lang } }));
    } catch (_) {}
  }

  async function setLang(lang) {
    const code = SUPPORTED_LANGS.includes(lang) ? lang : "en";
    try {
      sessionStorage.setItem(LS_KEY, code);
    } catch (_) {}
    await apply(code);
  }

  // ---- Fix: topbar must never lose Home/Translate/Mail Bills, even split-screen ----
  function setupResponsiveNav() {
    const nav = $("header nav");
    if (!nav) return;

    nav.style.position = nav.style.position || "relative";

    const primaryMatchers = [
      /(^|\/)index\.html(\?|#|$)/i,
      /(^|\/)translate\.html(\?|#|$)/i,
      /(^|\/)mail-bills\.html(\?|#|$)/i,
    ];

    const isPrimary = (href) => primaryMatchers.some((re) => re.test(href || ""));

    let moreBtn =
      $("#nav-more") ||
      nav.querySelector(".nav-more-btn") ||
      nav.querySelector("[data-nav-more]");

    let moreMenu =
      $("#nav-more-menu") ||
      nav.querySelector(".nav-more-menu");

    // Create button/menu if missing (keeps “More” from being a dead prop)
    if (!moreBtn) {
      moreBtn = document.createElement("button");
      moreBtn.type = "button";
      moreBtn.id = "nav-more";
      moreBtn.className = "glass-button nav-more-btn";
      moreBtn.textContent = "More";
      nav.appendChild(moreBtn);
    }

    if (!moreMenu) {
      moreMenu = document.createElement("div");
      moreMenu.id = "nav-more-menu";
      moreMenu.className = "glass-panel nav-more-menu";
      moreMenu.style.position = "absolute";
      moreMenu.style.right = "0";
      moreMenu.style.top = "calc(100% + 10px)";
      moreMenu.style.zIndex = "9999";
      moreMenu.style.minWidth = "180px";
      moreMenu.style.padding = "10px";
      moreMenu.style.display = "none";
      nav.appendChild(moreMenu);
    }

    moreBtn.setAttribute("aria-haspopup", "menu");
    moreBtn.setAttribute("aria-expanded", "false");

    function closeMenu() {
      moreMenu.style.display = "none";
      moreBtn.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      moreMenu.style.display = "block";
      moreBtn.setAttribute("aria-expanded", "true");
    }

    function toggleMenu(e) {
      e.preventDefault();
      e.stopPropagation();
      const open = moreBtn.getAttribute("aria-expanded") === "true";
      if (open) closeMenu();
      else openMenu();
    }

    moreBtn.addEventListener("click", toggleMenu);

    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target)) closeMenu();
    });

    window.addEventListener("scroll", closeMenu, { passive: true });
    window.addEventListener("resize", compute);

    function compute() {
      const links = Array.from(nav.querySelectorAll("a"));
      const primary = links.filter((a) => isPrimary(a.getAttribute("href") || ""));
      const secondary = links.filter((a) => !primary.includes(a));

      // Primary: NEVER hide.
      primary.forEach((a) => (a.style.display = "inline-flex"));

      // If you have no secondary links, hide More.
      if (!secondary.length) {
        moreBtn.style.display = "none";
        closeMenu();
        return;
      }

      // Consider “split-screen” a narrow viewport too.
      const narrow = window.matchMedia("(max-width: 900px)").matches;

      if (narrow) {
        secondary.forEach((a) => (a.style.display = "none"));
        moreBtn.style.display = "inline-flex";

        // Populate menu fresh
        moreMenu.innerHTML = "";
        secondary.forEach((a) => {
          const item = a.cloneNode(true);
          item.style.display = "block";
          item.style.margin = "8px 6px";
          item.style.opacity = "0.95";
          item.style.textDecoration = "none";
          item.style.color = "inherit";
          item.addEventListener("click", () => closeMenu());
          moreMenu.appendChild(item);
        });
      } else {
        secondary.forEach((a) => (a.style.display = "inline-flex"));
        moreBtn.style.display = "none";
        closeMenu();
      }
    }

    compute();
  }

  async function init() {
    // Inject Liquid Glass SVG filter definition once per page
    if (!document.getElementById("voy-lg-dist-svg")) {
      const holder = document.createElement("div");
      holder.innerHTML = `
<svg id="voy-lg-dist-svg" style="display:none" aria-hidden="true">
  <filter id="lg-dist" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="92" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2" result="blurred"/>
    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="70" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`;
      document.body.appendChild(holder.firstElementChild);
    }

    const initial = detect();
    await setLang(initial);

    // Circle menus
    const menus = $$(".lang-menu");
    if (menus.length) {
      menus.forEach((menu) => {
        const toggler = menu.querySelector(".lang-menu__toggler");
        const centerButton = menu.querySelector(".lang-menu__button");
        const options = menu.querySelectorAll(".lang-menu__link, .js-lang-option");

        if (centerButton && toggler) {
          centerButton.addEventListener("click", (e) => {
            e.stopPropagation();
            toggler.checked = !toggler.checked;
          });
        }

        options.forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const code = btn.getAttribute("data-lang");
            if (code) await setLang(code);
            if (toggler) toggler.checked = false;
          });
        });
      });

      document.addEventListener("click", (e) => {
        menus.forEach((menu) => {
          const toggler = menu.querySelector(".lang-menu__toggler");
          if (!toggler) return;
          if (!menu.contains(e.target)) toggler.checked = false;
        });
      });
    }

    setupResponsiveNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
