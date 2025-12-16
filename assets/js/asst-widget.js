/* =========================================================
   Voyadecir Assistant Widget
   Clara, your Assistant
   ========================================================= */

(function () {
  let isOpen = false;
  let currentLang = "en";

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function getLang() {
    return (
      window.currentLang ||
      localStorage.getItem("voyadecir_lang") ||
      document.documentElement.lang ||
      "en"
    );
  }

  function t(en, es) {
    return getLang() === "es" ? es : en;
  }

  function createWidget() {
    // Floating button
    const fab = el("button", "asst-fab");
    fab.type = "button";
    fab.textContent = "Clara, your Assistant";

    // Panel
    const panel = el("div", "asst-panel");

    const header = el("div", "asst-header");
    header.textContent = "Clara, your Assistant";

    const closeBtn = el("button", "asst-close", "×");
    closeBtn.type = "button";

    header.appendChild(closeBtn);

    const body = el("div", "asst-body");
    body.innerHTML = `
      <div class="asst-msg">
        ${t(
          "Hi, I’m Clara. I can help explain how Voyadecir works, or help you understand your translations.",
          "Hola, soy Clara. Puedo ayudarte a entender cómo funciona Voyadecir o aclarar tus traducciones."
        )}
      </div>
    `;

    const inputWrap = el("div", "asst-input");
    const input = el("input");
    input.type = "text";
    input.placeholder = t(
      "Ask me about Voyadecir…",
      "Pregúntame sobre Voyadecir…"
    );

    const sendBtn = el("button", "glass-button", t("Send", "Enviar"));

    inputWrap.appendChild(input);
    inputWrap.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(inputWrap);

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    function open() {
      panel.style.display = "block";
      isOpen = true;
      input.focus();
    }

    function close() {
      panel.style.display = "none";
      isOpen = false;
    }

    fab.addEventListener("click", () => {
      isOpen ? close() : open();
    });

    closeBtn.addEventListener("click", close);

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });

    async function send() {
      const msg = input.value.trim();
      if (!msg) return;

      body.insertAdjacentHTML(
        "beforeend",
        `<div class="asst-msg user">${msg}</div>`
      );
      input.value = "";
      body.scrollTop = body.scrollHeight;

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            lang: getLang()
          })
        });

        const data = await res.json();
        const reply =
          data?.reply ||
          t(
            "I can help with Voyadecir-related questions. If you’re having trouble, tell me what’s going wrong.",
            "Puedo ayudarte con preguntas sobre Voyadecir. Si tienes un problema, dime qué está pasando."
          );

        body.insertAdjacentHTML(
          "beforeend",
          `<div class="asst-msg">${reply}</div>`
        );
        body.scrollTop = body.scrollHeight;
      } catch {
        body.insertAdjacentHTML(
          "beforeend",
          `<div class="asst-msg">${t(
            "Something went wrong. Please try again.",
            "Algo salió mal. Inténtalo de nuevo."
          )}</div>`
        );
      }
    }

    // React to language changes instantly
    document.addEventListener("voyadecir:lang-changed", () => {
      header.textContent = "Clara, your Assistant";
      input.placeholder = t(
        "Ask me about Voyadecir…",
        "Pregúntame sobre Voyadecir…"
      );
    });
  }

  document.addEventListener("DOMContentLoaded", createWidget);
})();
