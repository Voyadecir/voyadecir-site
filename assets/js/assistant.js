/* =========================================================
   Voyadecir Assistant
   "Clara, your Assistant"
   - Single instance (prevents duplicates)
   - Language-aware UI strings
   - Soft redirect to Voyadecir scope
   - Optional support ticket submission (uses contact form if found)
   ========================================================= */

(function () {
  // Prevent duplicate injection even if script included twice
  if (window.__VOYADECIR_CLARA_LOADED__) return;
  window.__VOYADECIR_CLARA_LOADED__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }
  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  // Language source of truth: sessionStorage set by main.js
  function getLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  // Minimal strings (extend safely later)
  const STR = {
    en: {
      title: "Clara, your Assistant",
      close: "×",
      placeholder: "Ask me about Voyadecir…",
      send: "Send",
      hello:
        "Hi, I’m Clara. I can help explain how Voyadecir works, or help you understand your translations.",
      scope:
        "I can answer a couple questions, but I’m best at Voyadecir questions (web + future iOS/Android apps).",
      bugPrompt:
        "If this is a bug, describe what happened (what you uploaded, what you expected, and what you saw). I can log it for support.",
      logged:
        "Got it. I logged a support request for my bosses. You can also use the Contact page to follow up.",
      thinking: "Thinking…",
      error: "Something went wrong. Try again in a moment.",
    },
    es: {
      title: "Clara, tu Asistente",
      close: "×",
      placeholder: "Pregúntame sobre Voyadecir…",
      send: "Enviar",
      hello:
        "Hola, soy Clara. Puedo explicar cómo funciona Voyadecir o ayudarte a entender tus traducciones.",
      scope:
        "Puedo responder una o dos preguntas, pero soy mejor con preguntas sobre Voyadecir (web y futuras apps iOS/Android).",
      bugPrompt:
        "Si es un error, dime qué pasó (qué subiste, qué esperabas y qué viste). Puedo registrarlo para soporte.",
      logged:
        "Listo. Registré una solicitud de soporte para mis jefes. También puedes usar la página de Contacto para dar seguimiento.",
      thinking: "Pensando…",
      error: "Algo salió mal. Inténtalo de nuevo en un momento.",
    },
    pt: {
      title: "Clara, sua Assistente",
      close: "×",
      placeholder: "Pergunte sobre o Voyadecir…",
      send: "Enviar",
      hello:
        "Oi, eu sou a Clara. Posso explicar como o Voyadecir funciona ou ajudar você a entender suas traduções.",
      scope:
        "Posso responder uma ou duas perguntas, mas sou melhor com dúvidas sobre o Voyadecir (web e futuros apps iOS/Android).",
      bugPrompt:
        "Se for um bug, descreva o que aconteceu (o que você enviou, o que esperava e o que viu). Posso registrar para suporte.",
      logged:
        "Entendi. Registrei uma solicitação de suporte. Você também pode usar a página de Contato para acompanhar.",
      thinking: "Pensando…",
      error: "Algo deu errado. Tente novamente em instantes.",
    },
    fr: {
      title: "Clara, votre Assistante",
      close: "×",
      placeholder: "Demandez-moi sur Voyadecir…",
      send: "Envoyer",
      hello:
        "Bonjour, je suis Clara. Je peux expliquer comment Voyadecir fonctionne ou vous aider à comprendre vos traductions.",
      scope:
        "Je peux répondre à une ou deux questions, mais je suis surtout utile pour Voyadecir (web et futures apps iOS/Android).",
      bugPrompt:
        "Si c’est un bug, décrivez ce qui s’est passé (ce que vous avez envoyé, ce que vous attendiez, et ce que vous avez vu).",
      logged:
        "D’accord. J’ai enregistré une demande de support. Vous pouvez aussi utiliser la page Contact.",
      thinking: "Réflexion…",
      error: "Un problème est survenu. Réessayez dans un instant.",
    },
  };

  function s(key) {
    const lang = getLang();
    return (STR[lang] && STR[lang][key]) ? STR[lang][key] : STR.en[key];
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Inject CSS once
  function injectCss() {
    if (qs("#clara-widget-css")) return;
    const style = document.createElement("style");
    style.id = "clara-widget-css";
    style.textContent = `
      .clara-fab {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 99999;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .clara-fab span {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
      }

      .clara-panel {
        position: fixed;
        right: 24px;
        bottom: 80px;
        width: min(420px, calc(100vw - 32px));
        height: min(520px, calc(100vh - 140px));
        z-index: 99999;
        display: none;
        flex-direction: column;
        border-radius: 16px;
        overflow: hidden;
      }

      .clara-panel.open { display: flex; }

      .clara-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
      }
      .clara-title {
        font-weight: 700;
        font-size: 14px;
      }
      .clara-close {
        width: 32px;
        height: 32px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
      }

      .clara-body {
        padding: 12px 14px;
        overflow: auto;
        flex: 1;
      }

      .clara-msg {
        margin: 10px 0;
        padding: 10px 12px;
        border-radius: 14px;
        max-width: 92%;
        line-height: 1.25;
        font-size: 13px;
      }
      .clara-msg.user {
        margin-left: auto;
      }

      .clara-footer {
        padding: 10px 12px;
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .clara-input {
        flex: 1;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 13px;
        outline: none;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.10);
        color: inherit;
      }
      .clara-send {
        padding: 10px 14px;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 700;
        font-size: 12px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.10);
        color: inherit;
      }

      /* Keep above bottom bar if present */
      @media (max-width: 600px) {
        .clara-fab { right: 14px; bottom: 18px; }
        .clara-panel { right: 14px; bottom: 74px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Try to reuse glass class if site defines it
  function applyGlass(el) {
    el.classList.add("glass");
  }

  function buildWidget() {
    injectCss();

    // FAB
    const fab = document.createElement("div");
    fab.className = "clara-fab";
    applyGlass(fab);
    fab.setAttribute("role", "button");
    fab.setAttribute("aria-label", s("title"));
    fab.innerHTML = `<span>${escapeHtml(s("title"))}</span>`;

    // Panel
    const panel = document.createElement("div");
    panel.className = "clara-panel";
    applyGlass(panel);

    panel.innerHTML = `
      <div class="clara-header">
        <div class="clara-title">${escapeHtml(s("title"))}</div>
        <div class="clara-close" aria-label="${escapeHtml(s("close"))}">${escapeHtml(s("close"))}</div>
      </div>
      <div class="clara-body" id="clara-body"></div>
      <div class="clara-footer">
        <input class="clara-input" id="clara-input" type="text" placeholder="${escapeHtml(s("placeholder"))}" />
        <button class="clara-send" id="clara-send" type="button">${escapeHtml(s("send"))}</button>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    // Initial messages
    const body = qs("#clara-body", panel);
    function add(role, text) {
      const div = document.createElement("div");
      div.className = `clara-msg ${role}`;
      applyGlass(div);
      div.innerHTML = escapeHtml(text);
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }

    add("assistant", s("hello"));
    add("assistant", s("scope"));
    add("assistant", s("bugPrompt"));

    // Open / close
    function open() {
      panel.classList.add("open");
      const input = qs("#clara-input", panel);
      if (input) input.focus();
    }
    function close() {
      panel.classList.remove("open");
    }

    fab.addEventListener("click", open, { passive: true });
    fab.addEventListener("touchstart", open, { passive: true });
    qs(".clara-close", panel).addEventListener("click", close, { passive: true });

    // Send logic
    let softCount = 0;

    async function send() {
      const input = qs("#clara-input", panel);
      const msg = (input.value || "").trim();
      if (!msg) return;
      input.value = "";

      add("user", msg);

      // Soft redirect after 1–2 off-topic questions
      softCount++;

      add("assistant", s("thinking"));

      try {
        const lang = getLang();

        // Call real backend (ai-translator) by default.
        const base = (window.VOY_ASSISTANT_BASE || "https://ai-translator-i5jb.onrender.com").replace(/\/$/, "");
        const res = await fetch(base + "/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            lang,
            // lightweight context the backend can optionally use
            page: location.pathname,
          }),
        });

        if (!res.ok) {
          // Remove "thinking" bubble then show error
          body.removeChild(body.lastElementChild);
          add("assistant", s("error"));
          return;
        }

        const data = await res.json();

        // Remove thinking bubble
        body.removeChild(body.lastElementChild);

        // Show reply
        if (data && data.reply) {
          add("assistant", data.reply);
        } else {
          add("assistant", s("error"));
        }

        // Soft redirect reminder (only if user keeps going off track)
        if (softCount >= 3) {
          add("assistant", s("scope"));
          softCount = 0;
        }
      } catch (e) {
        // Remove thinking bubble
        if (body.lastElementChild) body.removeChild(body.lastElementChild);
        add("assistant", s("error"));
      }
    }

    qs("#clara-send", panel).addEventListener("click", send);
    qs("#clara-input", panel).addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    // Public hook for language refresh (main.js can call if desired)
    window.__claraRefreshLang = function () {
      // Update title/button/placeholder without re-injecting
      try {
        qs(".clara-title", panel).textContent = s("title");
        qs("#clara-send", panel).textContent = s("send");
        qs("#clara-input", panel).setAttribute("placeholder", s("placeholder"));
        qs("span", fab).textContent = s("title");
      } catch (_) {}
    };
  }

  // Wait until DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();
