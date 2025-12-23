/**
 * Voyadecir main.js
 * Responsibilities:
 * - Sticky top bar behaviors (More menu dropdown)
 * - Language selector (globe button) + language persistence
 * - Page-wide i18n for elements using data-i18n + data-i18n-placeholder
 * - Emits a global event so other scripts (assistant/mailbills/translate) can react
 */

(() => {
  "use strict";

  // ---- Config ----
  const STORAGE_KEY = "voyadecir_lang";
  const I18N_VERSION = "2";

  const SUPPORTED_LANGS = [
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "pt", label: "Portuguese" },
    { code: "fr", label: "French" },
    { code: "zh", label: "Chinese" },
    { code: "hi", label: "Hindi" },
    { code: "ar", label: "Arabic" },
    { code: "bn", label: "Bengali" },
    { code: "ru", label: "Russian" },
    { code: "ur", label: "Urdu" },
  ];

  // Minimal built-in fallback strings (so the site never goes blank)
  const FALLBACK_EN = {
    "nav.home": "Home",
    "nav.translate": "Translate",
    "nav.mail": "Mail & Bills",
    "nav.more": "More",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.privacy": "Privacy",
    "nav.terms": "Terms",
    "site.disclaimer":
      "Disclaimer: Voyadecir is for informational translation only and is not HIPAA- or FERPA-compliant. Do not upload personal health information (PHI) or student education records. Not legal, medical, or financial advice.",
    "mb.title": "Mail & Bills Helper",
    "mb.subtitle": "Upload a photo or PDF of your bill, letter, or document.",
    "mb.upload": "Upload Document",
    "mb.camera": "Take Picture",
    "mb.translate": "Translate",
    "mb.clear": "Clear",
    "mb.to": "To",
    "mb.copy.text": "Copy Text",
    "mb.copy.summary": "Copy Summary",
    "mb.download": "Download PDF",
    "mb.status.ready": "Ready",
    "mb.status.reading": "Reading document…",
    "mb.status.ocr": "Running OCR…",
    "mb.status.interpreting": "Explaining and translating…",
    "mb.status.done": "Done",
    "mb.status.error": "Something went wrong",
    "mb.status.no_text": "No text to export yet.",
    "mb.status.building_pdf": "Building PDF…",
    "mb.status.needs_upload": "Upload a document first.",
    "mb.clarifications": "We found possible ambiguities. Please clarify:",
    "mb.footnote": "Your document is processed securely and not stored permanently.",
    "translate.title": "Translate",
    "translate.subtitle": "Paste text to translate. Voyadecir is designed to translate with context, and can provide multiple meanings when needed.",
    "translate.button.translate": "Translate",
    "translate.button.clear": "Clear",
    "translate.button.paste": "Paste",
    "translate.button.copy": "Copy",
    "translate.to": "To",
    "translate.src.placeholder": "Enter text to translate…",
    "translate.out.placeholder": "Translation will appear here…",
    "translate.status.ready": "Ready",
    "translate.status.detecting": "Detecting language…",
    "translate.status.translating": "Translating…",
    "translate.status.done": "Done.",
    "translate.status.network_error": "Network error. Showing backup.",
    "translate.status.server_error": "Could not reach translator server. Showing backup.",
    "translate.status.need_text": "Type something to translate.",
    "translate.status.ambiguous": "Multiple meanings detected. Please clarify.",
    "translate.hint": "For best results, include context (who/what/where).",
    "assistant.title": "Clara, your Assistant",
    "assistant.placeholder": "Ask me about Voyadecir…",
    "assistant.thinking": "Thinking…",
    "assistant.error": "Something went wrong. Try again in a moment.",
    "assistant.scope": "I can answer a couple questions, but I’m best at Voyadecir questions (web + future iOS/Android apps).",
    "assistant.hello": "Hi, I’m Clara. I can help explain how Voyadecir works, or help you understand your translations.",
    "assistant.bugPrompt": "If this is a bug, describe what happened (what you uploaded, what you expected, and what you saw). I can log it for support.",
    "assistant.logged": "Got it. I logged a support request for my bosses. You can also use the Contact page to follow up.",
    "assistant.clarify": "I see possible ambiguities. Please share more detail so I can respond correctly.",
  };

  // ---- Utilities ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function safeGetLang() {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function safeSetLang(lang) {
    try {
      sessionStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
  }

  function normalizeLang(code) {
    const c = String(code || "").toLowerCase().trim();
    if (!c) return "en";
    const short = c.split("-")[0];
    return SUPPORTED_LANGS.some((l) => l.code === short) ? short : "en";
  }

  function detectLang() {
    const stored = safeGetLang();
    if (stored) return normalizeLang(stored);

    const nav = navigator.language || "en";
    return normalizeLang(nav);
  }

  // ---- i18n Loader ----
  async function loadLangDict(lang) {
    // Try assets/i18n/{lang}.json, fallback to en, then fallback dict.
    const url = `assets/i18n/${lang}.json?v=${I18N_VERSION}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("i18n fetch failed");
      const json = await res.json();
      if (json && typeof json === "object") return json;
    } catch (_) {}

    if (lang !== "en") {
      try {
        const resEn = await fetch(`assets/i18n/en.json?v=${I18N_VERSION}`, { cache: "no-store" });
        if (resEn.ok) {
          const j = await resEn.json();
          if (j && typeof j === "object") return j;
        }
      } catch (_) {}
    }

    return FALLBACK_EN;
  }

  function applyDict(dict) {
    // Text nodes
    $$("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const value = dict[key];
      if (typeof value === "string") el.textContent = value;
    });

    // Placeholders
    $$("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      const value = dict[key];
      if (typeof value === "string") el.setAttribute("placeholder", value);
    });
  }

  // ---- Language Menu UI ----
  function buildLangMenu(langMenuEl, currentLang) {
    langMenuEl.innerHTML = "";

    const list = document.createElement("div");
    list.className = "lang-menu-list";
    list.setAttribute("role", "menu");

    SUPPORTED_LANGS.forEach((l) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lang-menu-item";
      item.setAttribute("role", "menuitem");
      item.setAttribute("data-lang", l.code);
      item.textContent = l.label;

      if (l.code === currentLang) {
        item.classList.add("active");
        item.setAttribute("aria-current", "true");
      }

      item.addEventListener("click", () => {
        setLanguage(l.code);
        closeLangMenu();
      });

      list.appendChild(item);
    });

    langMenuEl.appendChild(list);
  }

  function openLangMenu() {
    const menu = $("#lang-menu");
    const btn = $("#lang-btn");
    if (!menu || !btn) return;

    menu.style.display = "block";
    menu.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
    menu.classList.add("open");

    // Ensure it stays above everything clickable
    menu.style.zIndex = "99999";
  }

  function closeLangMenu() {
    const menu = $("#lang-menu");
    const btn = $("#lang-btn");
    if (!menu || !btn) return;

    menu.classList.remove("open");
    menu.style.display = "none";
    menu.setAttribute("aria-hidden", "true");
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleLangMenu() {
    const menu = $("#lang-menu");
    if (!menu) return;
    const isOpen = menu.getAttribute("aria-hidden") === "false";
    if (isOpen) closeLangMenu();
    else openLangMenu();
  }

  // ---- More Menu UI ----
  function openMoreMenu() {
    const btn = $("#nav-more-btn");
    const menu = $("#nav-more-menu");
    if (!btn || !menu) return;
    btn.setAttribute("aria-expanded", "true");
    menu.classList.add("open");
    menu.style.display = "block";
    menu.style.zIndex = "99998";
  }

  function closeMoreMenu() {
    const btn = $("#nav-more-btn");
    const menu = $("#nav-more-menu");
    if (!btn || !menu) return;
    btn.setAttribute("aria-expanded", "false");
    menu.classList.remove("open");
    menu.style.display = "none";
  }

  function toggleMoreMenu() {
    const menu = $("#nav-more-menu");
    if (!menu) return;
    if (menu.classList.contains("open")) closeMoreMenu();
    else openMoreMenu();
  }

  // ---- Language setter ----
  let CURRENT_LANG = "en";
  let CURRENT_DICT = FALLBACK_EN;

  function t(key, fallback = "") {
    const val = CURRENT_DICT?.[key];
    if (typeof val === "string") return val;
    return fallback || key;
  }

  async function setLanguage(lang) {
    const normalized = normalizeLang(lang);
    CURRENT_LANG = normalized;
    safeSetLang(normalized);

    document.documentElement.setAttribute("lang", normalized);

    // Load and apply dict
    CURRENT_DICT = await loadLangDict(normalized);
    applyDict(CURRENT_DICT);

    window.VOY_I18N = {
      lang: CURRENT_LANG,
      dict: CURRENT_DICT,
      t,
    };

    // Rebuild menu highlighting
    const langMenu = $("#lang-menu");
    if (langMenu) buildLangMenu(langMenu, CURRENT_LANG);

    // Broadcast (assistant / mailbills / translate scripts can listen)
    window.dispatchEvent(
      new CustomEvent("voyadecir:lang-change", {
        detail: { lang: CURRENT_LANG, dict: CURRENT_DICT },
      })
    );
  }

  // ---- Wire up events ----
  function wireGlobalClickHandlers() {
    document.addEventListener("click", (e) => {
      const langMenu = $("#lang-menu");
      const langBtn = $("#lang-btn");

      const moreMenu = $("#nav-more-menu");
      const moreBtn = $("#nav-more-btn");

      // Close language menu on outside click
      if (langMenu && langBtn) {
        const clickedLang = langMenu.contains(e.target) || langBtn.contains(e.target);
        if (!clickedLang) closeLangMenu();
      }

      // Close more menu on outside click
      if (moreMenu && moreBtn) {
        const clickedMore = moreMenu.contains(e.target) || moreBtn.contains(e.target);
        if (!clickedMore) closeMoreMenu();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeLangMenu();
        closeMoreMenu();
      }
    });
  }

  function wireButtons() {
    const langBtn = $("#lang-btn");
    if (langBtn) {
      langBtn.setAttribute("aria-haspopup", "true");
      langBtn.setAttribute("aria-expanded", "false");

      // Click + touchstart to keep it responsive on mobile
      langBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleLangMenu();
      });

      langBtn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          toggleLangMenu();
        },
        { passive: false }
      );
    }

    const moreBtn = $("#nav-more-btn");
    if (moreBtn) {
      moreBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleMoreMenu();
      });

      moreBtn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          toggleMoreMenu();
        },
        { passive: false }
      );
    }
  }

  // ---- Init ----
  async function init() {
    // If markup forgot to include menus, don’t explode.
    const langMenu = $("#lang-menu");
    if (langMenu) {
      langMenu.style.display = "none";
      langMenu.setAttribute("aria-hidden", "true");
      langMenu.style.position = "fixed"; // keep above content even when scrolling
      langMenu.style.top = "72px"; // just under header
      langMenu.style.right = "16px";
    }

    const moreMenu = $("#nav-more-menu");
    if (moreMenu) {
      moreMenu.style.display = "none";
    }

    wireButtons();
    wireGlobalClickHandlers();

    // Language default
    const lang = detectLang();
    await setLanguage(lang);

    // Build lang menu once loaded
    if (langMenu) buildLangMenu(langMenu, CURRENT_LANG);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
