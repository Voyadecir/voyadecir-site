/**
 * asst-widget.js - Floating Chatbot Widget for Voyadecir
 * Creates a floating button that opens a chat panel on any page
 */
(function () {
  "use strict";

  // Set this when your real assistant endpoint exists
  var ASSISTANT_BASE = "";

  function $(s) { return document.querySelector(s); }

  function getLang() {
    try {
      return sessionStorage.getItem("voyadecir_lang") || "en";
    } catch (e) {
      return "en";
    }
  }

  var i18n = {
    en: {
      fabLabel: "Ask",
      panelTitle: "Voyadecir Assistant",
      placeholder: "Type your question...",
      send: "Send",
      typing: "Typing...",
      greeting: "Hi! I can help you with translating bills, taking photos, OCR, and more. What would you like to know?",
      errorFallback: "Server error. Using basic mode.",
      close: "X"
    },
    es: {
      fabLabel: "Preguntar",
      panelTitle: "Asistente Voyadecir",
      placeholder: "Escribe tu pregunta...",
      send: "Enviar",
      typing: "Escribiendo...",
      greeting: "Hola! Puedo ayudarte con traducir facturas, tomar fotos, OCR y mas. Que te gustaria saber?",
      errorFallback: "Error del servidor. Usando modo basico.",
      close: "X"
    }
  };

  function t(key) {
    var lang = getLang();
    return (i18n[lang] && i18n[lang][key]) || i18n.en[key] || key;
  }

  function localHelper(question, lang) {
    var q = (question || "").toLowerCase();
    
    var en = {
      hello: "Hi! Ask me about translating bills, taking a photo, or supported file types.",
      pdf: "Yes, you can upload PDFs and images. Clear, well-lit photos work best.",
      camera: "Use the Take Picture button on Mail and Bills. Make sure the text is sharp and fills the frame.",
      ocr: "OCR reads text in your image or PDF. We use Azure Vision to extract key fields like amount and due date.",
      translate: "Go to the Translate page for text translation, or use Mail and Bills for document images.",
      help: "I can help with: uploading documents, taking photos, OCR, translation, and understanding bills.",
      defaultMsg: "Got it. Ask about upload, camera, OCR, or supported docs."
    };
    
    var es = {
      hello: "Hola! Preguntame sobre traducir facturas, tomar una foto o los tipos de archivo.",
      pdf: "Si, puedes subir archivos PDF e imagenes. Las fotos claras funcionan mejor.",
      camera: "Usa el boton Tomar foto en Correo y Facturas. Asegurate de que el texto este nitido.",
      ocr: "OCR lee el texto de tu imagen o PDF. Usamos Azure Vision para extraer campos clave.",
      translate: "Ve a la pagina Traducir para traducir texto, o usa Correo y Facturas para documentos.",
      help: "Puedo ayudar con: subir documentos, tomar fotos, OCR, traduccion y entender facturas.",
      defaultMsg: "Entendido. Pregunta sobre subir, camara, OCR o documentos."
    };
    
    var dict = lang === "es" ? es : en;
    
    if (q.indexOf("pdf") !== -1 || q.indexOf("upload") !== -1 || q.indexOf("subir") !== -1) return dict.pdf;
    if (q.indexOf("camera") !== -1 || q.indexOf("foto") !== -1 || q.indexOf("picture") !== -1) return dict.camera;
    if (q.indexOf("ocr") !== -1 || q.indexOf("scan") !== -1 || q.indexOf("read") !== -1) return dict.ocr;
    if (q.indexOf("translate") !== -1 || q.indexOf("traducir") !== -1) return dict.translate;
    if (q.indexOf("help") !== -1 || q.indexOf("ayuda") !== -1) return dict.help;
    if (q.indexOf("hello") !== -1 || q.indexOf("hola") !== -1 || q.indexOf("hi") !== -1) return dict.hello;
    
    return dict.defaultMsg;
  }

  function callAssistantAPI(message, lang) {
    if (!ASSISTANT_BASE) {
      return Promise.resolve({ reply: localHelper(message, lang), backend: "local" });
    }
    
    var url = ASSISTANT_BASE + "/api/assistant";
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message, lang: lang })
    }).then(function(res) {
      if (!res.ok) {
        throw new Error("Server error " + res.status);
      }
      return res.json();
    });
  }

  function createWidget() {
    if (window.location.pathname.indexOf("assistant.html") !== -1) {
      console.log("[asst-widget] Skipping on assistant.html");
      return null;
    }

    if (document.getElementById("asst-fab")) {
      console.log("[asst-widget] Already exists");
      return null;
    }

    var fab = document.createElement("button");
    fab.id = "asst-fab";
    fab.className = "asst-fab";
    fab.type = "button";
    fab.innerHTML = "<span>" + t("fabLabel") + "</span>";

    var panel = document.createElement("div");
    panel.id = "asst-panel";
    panel.className = "asst-panel";
    panel.innerHTML = 
      '<div class="asst-head">' +
        '<span class="asst-title">' + t("panelTitle") + '</span>' +
        '<button class="asst-close" type="button">' + t("close") + '</button>' +
      '</div>' +
      '<div class="asst-body" id="asst-body"></div>' +
      '<div class="asst-foot">' +
        '<input type="text" class="asst-input" id="asst-input" placeholder="' + t("placeholder") + '" autocomplete="off">' +
        '<button class="asst-send" id="asst-send" type="button">' + t("send") + '</button>' +
      '</div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    console.log("[asst-widget] Created widget elements");
    return { fab: fab, panel: panel };
  }

  function appendMessage(role, text) {
    var body = document.getElementById("asst-body");
    if (!body) return;

    var msg = document.createElement("div");
    msg.className = "asst-msg " + role;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
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
        items.push({
          role: nodes[i].classList.contains("user") ? "user" : "bot",
          text: nodes[i].textContent || ""
        });
      }
      
      var last = items.slice(-20);
      sessionStorage.setItem("asst_widget_chat", JSON.stringify(last));
    } catch (e) {}
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
        console.error("[asst-widget] Error:", err);
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
      var input = document.getElementById("asst-input");
      if (input) {
        setTimeout(function() { input.focus(); }, 100);
      }
    } else {
      panel.style.display = "none";
    }
  }

  function init() {
    console.log("[asst-widget] Initializing...");
    
    var widgets = createWidget();
    if (!widgets) return;

    var fab = widgets.fab;
    var panel = widgets.panel;

    fab.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      fab.classList.add("clicked");
      togglePanel();
    });

    var closeBtn = panel.querySelector(".asst-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        togglePanel(false);
      });
    }

    var sendBtn = document.getElementById("asst-send");
    if (sendBtn) {
      sendBtn.addEventListener("click", function(e) {
        e.preventDefault();
        handleSend();
      });
    }

    var input = document.getElementById("asst-input");
    if (input) {
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    document.addEventListener("click", function(e) {
      var panelEl = document.getElementById("asst-panel");
      var fabEl = document.getElementById("asst-fab");
      
      if (!panelEl || !fabEl) return;
      if (panelEl.style.display !== "block") return;
      
      if (!panelEl.contains(e.target) && !fabEl.contains(e.target)) {
        togglePanel(false);
      }
    });

    var hasHistory = loadChat();
    if (!hasHistory) {
      appendMessage("bot", t("greeting"));
    }

    console.log("[asst-widget] Initialized successfully");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
