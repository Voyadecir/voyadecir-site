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
  
  const $ = function(s) { return document.querySelector(s); };

  function getLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (e) {
      return "en";
    }
  }

  // i18n strings for the widget
  var i18n = {
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
    var lang = getLang();
    return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
  }

  // ============================================================================
  // LOCAL HELPER (fallback when backend is unavailable)
  // ============================================================================
  
  function localHelper(question, lang) {
    var q = (question || "").toLowerCase();
    
    var en = {
      hello: "Hi! Ask me about translating bills, taking a photo, or supported file types. Try: "Can I upload a PDF?"",
      pdf: "Yes, you can upload PDFs and images. Clear, well-lit photos work best. For multi-page PDFs, we process all pages.",
      camera: "Use the Take Picture button on Mail & Bills. Make sure the text is sharp and fills the frame.",
      ocr: "OCR reads text in your image or PDF. We use Azure Vision + Document Intelligence to extract key fields like amount and due date.",
      translate: "Go to the Translate page for text translation, or use Mail & Bills for document images with OCR + translation.",
      help: "I can help with: uploading documents, taking photos, OCR (text recognition), translation, and understanding bills/mail.",
      defaultMsg: "Got it. I'll get smarter later when we connect the full assistant. For now, ask about upload, camera, OCR, or supported docs."
    };
    
    var es = {
      hello: "¡Hola! Pregúntame sobre traducir facturas, tomar una foto o los tipos de archivo. Prueba: "¿Puedo subir un PDF?"",
      pdf: "Sí, puedes subir archivos PDF e imágenes. Las fotos claras y bien iluminadas funcionan mejor. Procesamos todas las páginas.",
      camera: "Usa el botón Tomar foto en Correo y Facturas. Asegúrate de que el texto esté nítido y ocupe el cuadro.",
      ocr: "OCR lee el texto de tu imagen o PDF. Usamos Azure Vision + Document Intelligence para extraer campos clave como importe y fecha de vencimiento.",
      translate: "Ve a la página Traducir para traducir texto, o usa Correo y Facturas para imágenes de documentos con OCR + traducción.",
      help: "Puedo ayudar con: subir documentos, tomar fotos, OCR (reconocimiento de texto), traducción y entender facturas/correo.",
      defaultMsg: "Entendido. Pronto seré más inteligente cuando conectemos el asistente completo. Por ahora, pregunta sobre subir, cámara, OCR o documentos soportados."
    };
    
    var dict = lang === "es" ? es : en;
    
    if (q.indexOf("pdf") !== -1 || q.indexOf("upload") !== -1 || q.indexOf("subir") !== -1) return dict.pdf;
    if (q.indexOf("camera") !== -1 || q.indexOf("foto") !== -1 || q.indexOf("picture") !== -1 || q.indexOf("photo") !== -1) return dict.camera;
    if (q.indexOf("ocr") !== -1 || q.indexOf("scan") !== -1 || q.indexOf("read") !== -1) return dict.ocr;
    if (q.indexOf("translate") !== -1 || q.indexOf("traducir") !== -1 || q.indexOf("translation") !== -1) return dict.translate;
    if (q.indexOf("help") !== -1 || q.indexOf("ayuda") !== -1 || q.indexOf("what can") !== -1) return dict.help;
    if (q.indexOf("hello") !== -1 || q.indexOf("hola") !== -1 || q.indexOf("hi") !== -1 || q.indexOf("hey") !== -1) return dict.hello;
    
    return dict.defaultMsg;
  }

  // ============================================================================
  // API CALL
  // ============================================================================
  
  function fetchWithTimeout(url, opts, ms) {
    opts = opts || {};
    ms = ms || 12000;
    
    return new Promise(function(resolve, reject) {
      var ctrl = new AbortController();
      var timer = setTimeout(function() { ctrl.abort(); }, ms);
      
      fetch(url, Object.assign({}, opts, { signal: ctrl.signal }))
        .then(function(res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function(err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function callAssistantAPI(message, lang) {
    if (!ASSISTANT_BASE) {
      // No backend configured → use local helper
      return Promise.resolve({ reply: localHelper(message, lang), backend: "local" });
    }
    
    var url = ASSISTANT_BASE + "/api/assistant";
    return fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, lang: lang })
    }).then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          throw new Error("Assistant server " + res.status + ": " + text);
        });
      }
      return res.json();
    });
  }

  // ============================================================================
  // WIDGET DOM CREATION
  // ============================================================================
  
  function createWidget() {
    // Don't create widget on the assistant.html page (it has its own full chat)
    if (window.location.pathname.indexOf("assistant.html") !== -1) {
      console.log("[asst-widget] Skipping widget on assistant.html page");
      return null;
    }

    // Check if widget already exists (prevent duplicates)
    if (document.getElementById("asst-fab")) {
      console.log("[asst-widget] Widget already exists, skipping creation");
      return null;
    }

    // Create FAB (Floating Action Button)
    var fab = document.createElement("button");
    fab.id = "asst-fab";
    fab.className = "asst-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", t("fabLabel"));
    fab.innerHTML = "<span>" + t("fabLabel") + "</span>";

    // Create Panel
    var panel = document.createElement("div");
    panel.id = "asst-panel";
    panel.className = "asst-panel";
    panel.innerHTML = 
      '<div class="asst-head">' +
        '<span class="asst-title">' + t("panelTitle") + '</span>' +
        '<button class="asst-close" type="button" aria-label="Close">' + t("close") + '</button>' +
      '</div>' +
      '<div class="asst-body" id="asst-body"></div>' +
      '<div class="asst-foot">' +
        '<input type="text" class="asst-input" id="asst-input" placeholder="' + t("placeholder") + '" autocomplete="off">' +
        '<button class="asst-send" id="asst-send" type="button">' + t("send") + '</button>' +
      '</div>';

    // Append to body
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    console.log("[asst-widget] Widget elements created and appended to body");

    return { fab: fab, panel: panel };
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================
  
  function appendMessage(role, text) {
    var body = document.getElementById("asst-body");
    if (!body) return;

    var msg = document.createElement("div");
    msg.className = "asst-msg " + role;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;

    // Persist to sessionStorage
    persistChat();
  }

  function showTyping(show) {
    var body = document.getElementById("asst-body");
    if (!body) return;

    var typingEl = document.getElementById("asst-typing");
    
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
      var body = document.getElementById("asst-body");
      if (!body) return;
      
      var nodes = body.querySelectorAll(".asst-msg");
      var items = [];
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        items.push({
          role: n.classList.contains("user") ? "user" : "bot",
          text: n.textContent || ""
        });
      }
      
      // Keep last 20 messages
      var last = items.slice(-20);
      sessionStorage.setItem("asst_widget_chat", JSON.stringify(last));
    } catch (e) {
      // Ignore storage errors
    }
  }

  function loadChat() {
    try {
      var raw = sessionStorage.getItem("asst_widget_chat");
      if (!raw) return false;
      
      var items = JSON.parse(raw);
      for (var i = 0; i < items.length; i++) {
        appendMessage(items[i].role, items[i].text);
      }
      return items.length > 0;
    } catch (e) {
      return false;
    }
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  var isPending = false;

  function handleSend() {
    if (isPending) return;

    var input = document.getElementById("asst-input");
    if (!input) return;

    var text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    input.value = "";
    showTyping(true);
    isPending = true;

    var lang = getLang();
    callAssistantAPI(text, lang)
      .then(function(data) {
        var reply = (data && data.reply) || localHelper(text, lang);
        showTyping(false);
        appendMessage("bot", reply);
        isPending = false;
      })
      .catch(function(err) {
        console.error("[asst-widget] API error:", err);
        showTyping(false);
        appendMessage("bot", t("errorFallback"));
        appendMessage("bot", localHelper(text, getLang()));
        isPending = false;
      });
  }

  function togglePanel(show) {
    var panel = document.getElementById("asst-panel");
    var fab = document.getElementById("asst-fab");
    
    if (!panel || !fab) return;

    if (show === undefined) {
      show = panel.style.display !== "block";
    }

    if (show) {
      panel.style.display = "block";
      fab.classList.add("clicked");
      
      // Focus input when opening
      var input = document.getElementById("asst-input");
      if (input) {
        setTimeout(function() { input.focus(); }, 100);
      }
    } else {
      panel.style.display = "none";
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  function init() {
    console.log("[asst-widget] Initializing chatbot widget...");
    
    var widgets = createWidget();
    if (!widgets) {
      console.log("[asst-widget] Widget creation skipped");
      return;
    }

    var fab = widgets.fab;
    var panel = widgets.panel;

    // Toggle panel on FAB click
    fab.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      fab.classList.add("clicked"); // Stop bounce animation
      togglePanel();
    });

    // Close button
    var closeBtn = panel.querySelector(".asst-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        togglePanel(false);
      });
    }

    // Send button
    var sendBtn = document.getElementById("asst-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", function(e) {
        e.preventDefault();
        handleSend();
      });
    }

    // Enter key to send
    var input = document.getElementById("asst-input");
    if (input) {
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Click outside to close
    document.addEventListener("click", function(e) {
      var panelEl = document.getElementById("asst-panel");
      var fabEl = document.getElementById("asst-fab");
      
      if (!panelEl || !fabEl) return;
      if (panelEl.style.display !== "block") return;
      
      // If click is outside both panel and fab, close
      if (!panelEl.contains(e.target) && !fabEl.contains(e.target)) {
        togglePanel(false);
      }
    });

    // Load previous chat or show greeting
    var hasHistory = loadChat();
    if (!hasHistory) {
      appendMessage("bot", t("greeting"));
    }

    console.log("[asst-widget] Chatbot widget initialized successfully");
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // DOM already ready, run now
    init();
  }
})();
