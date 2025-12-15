/**
 * asst-widget.js - Floating Chatbot Widget for Voyadecir
 * Creates a floating button that opens a chat panel on any page
 * 
 * Usage: Include <script defer src="assets/js/asst-widget.js?v=4"></script> in your HTML
 * 
 * This widget uses the same deep agent backend as the assistant page,
 * with fallback to local helper when backend is unavailable.
 */
(function () {
  "use strict";

  // ============================================================================
  // CONFIGURATION
  // ============================================================================
  
  // Set this when your real assistant endpoint exists:
  // Example: "https://voyadecir-ai-functions.azurewebsites.net"
  const ASSISTANT_BASE = ""; // keep empty for now → uses safe local helper

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  const $ = (s) => document.querySelector(s);

  function getLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (_) {
      return "en";
    }
  }

  // i18n strings for the widget
  const i18n = {
    en: {
      fabLabel: "💬 Ask",
      panelTitle: "Voyadecir Assistant",
      placeholder: "Type your question…",
      send: "Send",
      typing: "Typing…",
      greeting: "Hi! I can help you with translating bills, taking photos, OCR, and more. What would you like to know?",
      errorFallback: "Server error. I'll use basic mode.",
      close: "✕"
    },
    es: {
      fabLabel: "💬 Preguntar",
      panelTitle: "Asistente Voyadecir",
      placeholder: "Escribe tu pregunta…",
      send: "Enviar",
      typing: "Escribiendo…",
      greeting: "¡Hola! Puedo ayudarte con traducir facturas, tomar fotos, OCR y más. ¿Qué te gustaría saber?",
      errorFallback: "Error del servidor. Usaré el modo básico.",
      close: "✕"
    }
  };

  function t(key) {
    const lang = getLang();
    return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
  }

  // ============================================================================
  // LOCAL HELPER (fallback when backend is unavailable)
  // ============================================================================
  
  function localHelper(question, lang) {
    const q = (question || "").toLowerCase();
    
    const en = {
      hello: "Hi! Ask me about translating bills, taking a photo, or supported file types. Try: "Can I upload a PDF?"",
      pdf: "Yes, you can upload PDFs and images. Clear, well-lit photos work best. For multi-page PDFs, we process all pages.",
      camera: "Use the Take Picture button on Mail & Bills. Make sure the text is sharp and fills the frame.",
      ocr: "OCR reads text in your image or PDF. We use Azure Vision + Document Intelligence to extract key fields like amount and due date.",
      translate: "Go to the Translate page for text translation, or use Mail & Bills for document images with OCR + translation.",
      help: "I can help with: uploading documents, taking photos, OCR (text recognition), translation, and understanding bills/mail.",
      default: "Got it. I'll get smarter later when we connect the full assistant. For now, ask about upload, camera, OCR, or supported docs."
    };
    
    const es = {
      hello: "¡Hola! Pregúntame sobre traducir facturas, tomar una foto o los tipos de archivo. Prueba: "¿Puedo subir un PDF?"",
      pdf: "Sí, puedes subir archivos PDF e imágenes. Las fotos claras y bien iluminadas funcionan mejor. Procesamos todas las páginas.",
      camera: "Usa el botón Tomar foto en Correo y Facturas. Asegúrate de que el texto esté nítido y ocupe el cuadro.",
      ocr: "OCR lee el texto de tu imagen o PDF. Usamos Azure Vision + Document Intelligence para extraer campos clave como importe y fecha de vencimiento.",
      translate: "Ve a la página Traducir para traducir texto, o usa Correo y Facturas para imágenes de documentos con OCR + traducción.",
      help: "Puedo ayudar con: subir documentos, tomar fotos, OCR (reconocimiento de texto), traducción y entender facturas/correo.",
      default: "Entendido. Pronto seré más inteligente cuando conectemos el asistente completo. Por ahora, pregunta sobre subir, cámara, OCR o documentos soportados."
    };
    
    const dict = lang === "es" ? es : en;
    
    if (q.includes("pdf") || q.includes("upload") || q.includes("subir")) return dict.pdf;
    if (q.includes("camera") || q.includes("foto") || q.includes("picture") || q.includes("photo")) return dict.camera;
    if (q.includes("ocr") || q.includes("scan") || q.includes("read")) return dict.ocr;
    if (q.includes("translate") || q.includes("traducir") || q.includes("translation")) return dict.translate;
    if (q.includes("help") || q.includes("ayuda") || q.includes("what can")) return dict.help;
    if (q.includes("hello") || q.includes("hola") || q.includes("hi") || q.includes("hey")) return dict.hello;
    
    return dict.default;
  }

  // ============================================================================
  // API CALL
  // ============================================================================
  
  async function fetchWithTimeout(url, opts = {}, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  async function callAssistantAPI(message, lang) {
    if (!ASSISTANT_BASE) {
      // No backend configured → use local helper
      return { reply: localHelper(message, lang), backend: "local" };
    }
    
    const url = `${ASSISTANT_BASE}/api/assistant`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, lang })
    });
    
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Assistant server ${res.status}: ${text}`);
    }
    
    return res.json();
  }

  // ============================================================================
  // WIDGET DOM CREATION
  // ============================================================================
  
  function createWidget() {
    // Don't create widget on the assistant.html page (it has its own full chat)
    if (window.location.pathname.includes("assistant.html")) {
      return null;
    }

    // Create FAB (Floating Action Button)
    const fab = document.createElement("button");
    fab.id = "asst-fab";
    fab.className = "asst-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", t("fabLabel"));
    fab.innerHTML = `<span>${t("fabLabel")}</span>`;

    // Create Panel
    const panel = document.createElement("div");
    panel.id = "asst-panel";
    panel.className = "asst-panel";
    panel.innerHTML = `
      <div class="asst-head">
        <span class="asst-title">${t("panelTitle")}</span>
        <button class="asst-close" type="button" aria-label="Close">${t("close")}</button>
      </div>
      <div class="asst-body" id="asst-body">
        <!-- Messages appear here -->
      </div>
      <div class="asst-foot">
        <input type="text" class="asst-input" id="asst-input" placeholder="${t("placeholder")}" autocomplete="off">
        <button class="asst-send" id="asst-send" type="button">${t("send")}</button>
      </div>
    `;

    // Append to body
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    return { fab, panel };
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================
  
  function appendMessage(role, text) {
    const body = $("#asst-body");
    if (!body) return;

    const msg = document.createElement("div");
    msg.className = `asst-msg ${role}`;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;

    // Persist to sessionStorage
    persistChat();
  }

  function showTyping(show) {
    const body = $("#asst-body");
    if (!body) return;

    let typingEl = $("#asst-typing");
    
    if (show) {
      if (!typingEl) {
        typingEl = document.createElement("div");
        typingEl.id = "asst-typing";
        typingEl.className = "asst-msg bot";
        typingEl.textContent = t("typing");
        body.appendChild(typingEl);
        body.scrollTop = body.scrollHeight;
      }
    } else if (typingEl) {
      typingEl.remove();
    }
  }

  function persistChat() {
    try {
      const body = $("#asst-body");
      if (!body) return;
      
      const nodes = [...body.querySelectorAll(".asst-msg")];
      const items = nodes.map((n) => ({
        role: n.classList.contains("user") ? "user" : "bot",
        text: n.textContent || ""
      }));
      
      // Keep last 20 messages
      const last = items.slice(-20);
      sessionStorage.setItem("asst_widget_chat", JSON.stringify(last));
    } catch (_) {
      // Ignore storage errors
    }
  }

  function loadChat() {
    try {
      const raw = sessionStorage.getItem("asst_widget_chat");
      if (!raw) return false;
      
      const items = JSON.parse(raw);
      items.forEach((m) => appendMessage(m.role, m.text));
      return items.length > 0;
    } catch (_) {
      return false;
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  let isPending = false;

  async function handleSend() {
    if (isPending) return;

    const input = $("#asst-input");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    input.value = "";
    showTyping(true);
    isPending = true;

    try {
      const lang = getLang();
      const data = await callAssistantAPI(text, lang);
      const reply = data?.reply || localHelper(text, lang);
      
      showTyping(false);
      appendMessage("bot", reply);
    } catch (err) {
      console.error("[asst-widget] API error:", err);
      showTyping(false);
      appendMessage("bot", t("errorFallback"));
      appendMessage("bot", localHelper(text, getLang()));
    } finally {
      isPending = false;
    }
  }

  function togglePanel(show) {
    const panel = $("#asst-panel");
    const fab = $("#asst-fab");
    
    if (!panel || !fab) return;

    if (show === undefined) {
      show = panel.style.display !== "block";
    }

    if (show) {
      panel.style.display = "block";
      fab.classList.add("clicked");
      
      // Focus input when opening
      const input = $("#asst-input");
      if (input) {
        setTimeout(() => input.focus(), 100);
      }
    } else {
      panel.style.display = "none";
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  function init() {
    const widgets = createWidget();
    if (!widgets) return; // Don't initialize on assistant.html

    const { fab, panel } = widgets;

    // Toggle panel on FAB click
    fab.addEventListener("click", () => {
      fab.classList.add("clicked"); // Stop bounce animation
      togglePanel();
    });

    // Close button
    const closeBtn = panel.querySelector(".asst-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => togglePanel(false));
    }

    // Send button
    const sendBtn = $("#asst-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", handleSend);
    }

    // Enter key to send
    const input = $("#asst-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Click outside to close
    document.addEventListener("click", (e) => {
      const panel = $("#asst-panel");
      const fab = $("#asst-fab");
      
      if (!panel || !fab) return;
      if (panel.style.display !== "block") return;
      
      // If click is outside both panel and fab, close
      if (!panel.contains(e.target) && !fab.contains(e.target)) {
        togglePanel(false);
      }
    });

    // Load previous chat or show greeting
    const hasHistory = loadChat();
    if (!hasHistory) {
      appendMessage("bot", t("greeting"));
    }
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
