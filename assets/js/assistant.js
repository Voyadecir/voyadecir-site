(() => {
  "use strict";

  // ===== Config =====
  const AI_TRANSLATOR_BASE =
    (window.VOY_AI_TRANSLATOR_BASE || "https://ai-translator-i5jb.onrender.com").replace(
      /\/$/,
      ""
    );

  const URL_ASSIST = `${AI_TRANSLATOR_BASE}/api/assistant`;

  // ===== i18n strings for widget =====
  const STR = {
    en: {
      title: "Clara",
      placeholder: "Ask me anything…",
      send: "Send",
      open: "Chat",
      close: "Close",
      hello: "Hi. I’m Clara. How can I help?",
      clarify: "I found a couple things that could mean two different things. Which one do you mean?",
      error: "Something went wrong. Try again.",
    },
    es: {
      title: "Clara",
      placeholder: "Pregúntame lo que sea…",
      send: "Enviar",
      open: "Chat",
      close: "Cerrar",
      hello: "Hola. Soy Clara. ¿Cómo puedo ayudarte?",
      clarify:
        "Encontré un par de cosas que podrían significar dos cosas diferentes. ¿Cuál querías decir?",
      error: "Algo salió mal. Inténtalo otra vez.",
    },
  };

  function uiLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  function s(key) {
    const lang = uiLang();
    return (STR[lang] && STR[lang][key]) || STR.en[key] || key;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildWidget() {
    // Insert minimal CSS (avoid collisions)
    const style = document.createElement("style");
    style.textContent = `
      .clara-fab {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9999;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        background: rgba(255,255,255,0.16);
        color: #fff;
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        cursor: pointer;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .clara-panel {
        position: fixed;
        right: 18px;
        bottom: 72px;
        width: min(380px, calc(100vw - 36px));
        height: 520px;
        max-height: calc(100vh - 110px);
        z-index: 9999;
        border-radius: 18px;
        overflow: hidden;
        background: rgba(10,10,10,0.25);
        border: 1px solid rgba(255,255,255,0.18);
        backdrop-filter: blur(18px) saturate(140%);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        box-shadow: 0 18px 60px rgba(0,0,0,0.35);
        display: none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #fff;
      }
      .clara-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.08);
      }
      .clara-title { font-weight: 650; letter-spacing: 0.2px; }
      .clara-close {
        border:none;
        background: rgba(255,255,255,0.12);
        color:#fff;
        padding: 8px 10px;
        border-radius: 12px;
        cursor:pointer;
      }
      .clara-body {
        height: calc(100% - 112px);
        overflow:auto;
        padding: 12px;
      }
      .clara-msg {
        display:flex;
        margin: 10px 0;
      }
      .clara-assistant { justify-content:flex-start; }
      .clara-user { justify-content:flex-end; }
      .clara-bubble {
        max-width: 85%;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.10);
        line-height: 1.35;
        font-size: 14px;
        white-space: pre-wrap;
      }
      .clara-user .clara-bubble {
        background: rgba(120,120,255,0.18);
      }
      .clara-footer {
        display:flex;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.06);
      }
      .clara-input {
        flex:1;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(0,0,0,0.18);
        color: #fff;
        padding: 10px 10px;
        outline: none;
      }
      .clara-send {
        border:none;
        border-radius: 12px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.14);
        color:#fff;
        cursor:pointer;
      }
    `;
    document.head.appendChild(style);

    const fab = document.createElement("button");
    fab.className = "clara-fab";
    fab.type = "button";
    fab.textContent = s("open");

    const panel = document.createElement("div");
    panel.className = "clara-panel";

    const header = document.createElement("div");
    header.className = "clara-header";

    const title = document.createElement("div");
    title.className = "clara-title";
    title.textContent = s("title");

    const closeBtn = document.createElement("button");
    closeBtn.className = "clara-close";
    closeBtn.type = "button";
    closeBtn.textContent = s("close");

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "clara-body";

    const footer = document.createElement("div");
    footer.className = "clara-footer";

    const input = document.createElement("input");
    input.className = "clara-input";
    input.type = "text";
    input.placeholder = s("placeholder");
    input.autocomplete = "off";

    const sendBtn = document.createElement("button");
    sendBtn.className = "clara-send";
    sendBtn.type = "button";
    sendBtn.textContent = s("send");

    footer.appendChild(input);
    footer.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(footer);

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    function open() {
      panel.style.display = "block";
      input.focus();
    }
    function close() {
      panel.style.display = "none";
    }

    fab.addEventListener("click", () => {
      if (panel.style.display === "block") close();
      else open();
    });
    closeBtn.addEventListener("click", close);

    function add(role, text) {
      const msg = document.createElement("div");
      msg.className = `clara-msg clara-${role}`;

      const bubble = document.createElement("div");
      bubble.className = "clara-bubble";
      bubble.innerHTML = escapeHtml(text);

      msg.appendChild(bubble);
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
    }

    async function ask(text) {
      add("user", text);

      try {
        const res = await fetch(URL_ASSIST, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            ui_lang: uiLang(),
          }),
        });

        const raw = await res.text().catch(() => "");
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (_) {}

        if (!res.ok) {
          const msg =
            json?.detail || json?.message || raw || `${s("error")} (HTTP ${res.status})`;
          add("assistant", String(msg));
          return;
        }

        const answer = json?.answer || json?.message || json?.text || "";
        add("assistant", String(answer || ""));
      } catch (_) {
        add("assistant", s("error"));
      }
    }

    function onSend() {
      const v = (input.value || "").trim();
      if (!v) return;
      input.value = "";
      ask(v);
    }

    sendBtn.addEventListener("click", onSend);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") onSend();
    });

    // greet once
    add("assistant", s("hello"));

    // allow the rest of the site to force a language refresh
    window.__claraRefreshLang = function () {
      try {
        fab.textContent = s("open");
        closeBtn.textContent = s("close");
        title.textContent = s("title");
        input.placeholder = s("placeholder");
        sendBtn.textContent = s("send");
      } catch (_) {}
    };

    // Public API so other pages (mail-bills.js) can "speak" through Clara.
    // Safe rendering: plain text + bullet lists rendered as real <ul>.
    function addBullets(role, introText, bullets) {
      try {
        const msg = document.createElement("div");
        msg.className = `clara-msg clara-${role}`;

        const bubble = document.createElement("div");
        bubble.className = "clara-bubble";

        if (introText) {
          const p = document.createElement("div");
          p.textContent = String(introText);
          bubble.appendChild(p);
        }

        const ul = document.createElement("ul");
        ul.style.margin = "8px 0 0 18px";
        ul.style.padding = "0";
        ul.style.lineHeight = "1.35";

        (bullets || []).forEach((b) => {
          const li = document.createElement("li");
          li.textContent = String(b);
          ul.appendChild(li);
        });

        bubble.appendChild(ul);
        msg.appendChild(bubble);
        body.appendChild(msg);
        body.scrollTop = body.scrollHeight;
      } catch (_) {}
    }

    window.VOY_CLARA = window.VOY_CLARA || {};

    // Speak a plain message in the Clara panel
    window.VOY_CLARA.say = function (text, opts = {}) {
      const role = opts.role === "user" ? "user" : "assistant";
      add(role, String(text || ""));
    };

    // Speak a clarification request with bullet options/questions
    window.VOY_CLARA.clarify = function (items, opts = {}) {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return;

      const intro = opts.intro || s("clarify");

      const bullets = list
        .map((item) => (item?.prompt || item?.question || item?.text || item?.word || "").toString())
        .filter(Boolean);

      if (!bullets.length) return;
      addBullets("assistant", intro, bullets);
    };
  }

  // init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
