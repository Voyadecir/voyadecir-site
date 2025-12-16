/* =========================================================
   Voyadecir Assistant Widget
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

  function getLang() {
    return (
      window.currentLang ||
      localStorage.getItem("voyadecir_lang") ||
      document.documentElement.lang ||
      "en"
    );
  }

  const STR = {
    en: {
      name: "Clara, your Assistant",
      hello:
        "Hi, I’m Clara. I can help you use Voyadecir, understand translations, and troubleshoot problems.",
      placeholder: "Ask me about Voyadecir…",
      send: "Send",
      thinking: "Thinking…",
      tryAgain: "Something went wrong. Please try again.",
      scopeNudge:
        "Quick note: I’m best at Voyadecir questions (Translate, Mail & Bills, the apps). Tell me what you’re trying to do.",
      ticketPrompt:
        "If this is a bug, describe what happened (what you uploaded, what you expected, and what you saw). I can log it for support.",
      ticketLogged:
        "Got it. I logged this for Voyadecir support. If you want faster help, also use the Contact page.",
      ticketFail:
        "I couldn’t log that automatically. Please use the Contact page so your message reaches support.",
      askDetails:
        "Tell me what happened, and include the error message if you have it."
    },
    es: {
      name: "Clara, your Assistant",
      hello:
        "Hola, soy Clara. Puedo ayudarte a usar Voyadecir, entender traducciones y solucionar problemas.",
      placeholder: "Pregúntame sobre Voyadecir…",
      send: "Enviar",
      thinking: "Pensando…",
      tryAgain: "Algo salió mal. Inténtalo de nuevo.",
      scopeNudge:
        "Nota rápida: soy mejor con preguntas sobre Voyadecir (Translate, Mail & Bills y las apps). Dime qué intentas hacer.",
      ticketPrompt:
        "Si es un error, describe qué pasó (qué subiste, qué esperabas y qué viste). Puedo registrarlo para soporte.",
      ticketLogged:
        "Listo. Registré esto para soporte de Voyadecir. Si quieres ayuda más rápida, usa también la página de Contacto.",
      ticketFail:
        "No pude registrarlo automáticamente. Usa la página de Contacto para que tu mensaje llegue a soporte.",
      askDetails:
        "Cuéntame qué pasó e incluye el mensaje de error si lo tienes."
    }
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

  function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  function appendMsg(body, text, isUser = false) {
    const msg = createEl("div", isUser ? "asst-msg user" : "asst-msg");
    msg.innerHTML = escapeHtml(text);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  function getTicketEndpointFromContactForm() {
    // If you later wire Formspree, we can read it from contact.html form[action]
    const form = qs("form#contact-form") || qs("form[action*='formspree']") || qs("form[action]");
    const action = form?.getAttribute("action");
    if (!action) return null;

    // Only allow remote endpoints (Formspree etc.). If it's just /contact, skip.
    if (action.startsWith("http://") || action.startsWith("https://")) return action;
    return null;
  }

  async function submitTicket(message) {
    const endpoint = getTicketEndpointFromContactForm();
    if (!endpoint) return false;

    // Minimal payload (works with Formspree-style endpoints)
    try {
      const payload = {
        subject: "Voyadecir Support Ticket (Clara)",
        message,
        page: location.href,
        lang: getLang(),
        ts: new Date().toISOString(),
        ua: navigator.userAgent
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  function looksLikeOffTopic(text) {
    const t = text.toLowerCase();
    // very light heuristic: allow most things, nudge when obviously unrelated
    const offTopicSignals = [
      "movie", "song", "lyrics", "celebrity", "sports score", "stock price",
      "dating", "politics", "crypto", "weapon", "hack", "cheat"
    ];
    return offTopicSignals.some(k => t.includes(k));
  }

  function ensureWidgetOnce() {
    if (qs(".asst-fab") || qs(".asst-panel")) return;

    const fab = createEl("button", "asst-fab", s("name"));
    fab.type = "button";
    fab.setAttribute("aria-label", s("name"));

    const panel = createEl("div", "asst-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", s("name"));
    panel.style.display = "none";

    const header = createEl("div", "asst-header", s("name"));

    const closeBtn = createEl("button", "asst-close", "×");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");

    header.appendChild(closeBtn);

    const body = createEl("div", "asst-body");
    appendMsg(body, s("hello"));
    appendMsg(body, s("ticketPrompt"));

    const inputWrap = createEl("div", "asst-input");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = s("placeholder");

    const sendBtn = createEl("button", "glass-button", s("send"));
    sendBtn.type = "button";

    inputWrap.appendChild(input);
    inputWrap.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(inputWrap);

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
      panel.style.display === "block" ? close() : open();
    });

    closeBtn.addEventListener("click", close);

    async function send() {
      const msg = (input.value || "").trim();
      if (!msg) return;

      appendMsg(body, msg, true);
      input.value = "";

      // Soft redirect for obvious off-topic
      if (looksLikeOffTopic(msg)) {
        appendMsg(body, s("scopeNudge"));
      }

      // Attempt assistant backend (if available)
      sendBtn.disabled = true;
      const oldLabel = sendBtn.textContent;
      sendBtn.textContent = s("thinking");

      let replied = false;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, lang: getLang(), page: location.pathname })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data && typeof data.reply === "string" && data.reply.trim()) {
          appendMsg(body, data.reply.trim());
          replied = true;
        }
      } catch {
        // ignore; we’ll fallback
      }

      // Fallback: if assistant backend isn’t reachable, still be useful
      if (!replied) {
        appendMsg(body, s("askDetails"));
      }

      // Ticket logging trigger (when user says problem/bug/error)
      const lower = msg.toLowerCase();
      const wantsTicket =
        lower.includes("bug") ||
        lower.includes("error") ||
        lower.includes("broken") ||
        lower.includes("doesn't work") ||
        lower.includes("doesnt work") ||
        lower.includes("problem") ||
        lower.includes("issue") ||
        lower.includes("ocr") ||
        lower.includes("pdf");

      if (wantsTicket) {
        const ok = await submitTicket(msg);
        appendMsg(body, ok ? s("ticketLogged") : s("ticketFail"));
      }

      sendBtn.disabled = false;
      sendBtn.textContent = oldLabel;
      body.scrollTop = body.scrollHeight;
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    // Live language updates
    document.addEventListener("voyadecir:lang-changed", () => {
      fab.textContent = s("name");
      header.childNodes[0].textContent = s("name"); // header text node
      input.placeholder = s("placeholder");
    });
  }

  document.addEventListener("DOMContentLoaded", ensureWidgetOnce);
})();
