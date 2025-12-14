// asst-widget.js - Voyadecir Assistant Widget (Mode 1 + Mode 2 ready)
// FIXED: Syntax error on line 170
const ASSISTANT_BASE = "https://ai-translator-i5jb.onrender.com";

(function(){
  // Language helper
  const lang = () => {
    try { 
      return sessionStorage.getItem('voyadecir_lang') || 'en'; 
    } catch (_) { 
      return 'en'; 
    }
  };

  // Document memory: store last uploaded document context
  const getLastDocument = () => {
    try {
      const doc = sessionStorage.getItem('voyadecir_last_document');
      return doc ? JSON.parse(doc) : null;
    } catch (_) {
      return null;
    }
  };

  // Tiny local helper (fallback when backend unavailable)
  function localHelper(q, l) {
    q = (q || "").toLowerCase();
    const en = {
      hello: "Hi! I can help you understand bills, letters, and documents. Ask me: 'How do I upload a PDF?' or 'What languages do you support?'",
      pdf: "Yes, you can upload PDFs and images. Clear, well-lit photos work best. Go to Mail & Bills Helper to get started.",
      camera: "Use the 'Take Picture' button on the Mail & Bills page. Make sure the text is sharp and fills the frame.",
      ocr: "OCR (Optical Character Recognition) reads text from images and PDFs. We use Azure Document Intelligence to extract key details like amounts and dates.",
      languages: "We support 10 languages: English, Spanish, Portuguese, French, Chinese, Hindi, Arabic, Bengali, Russian, and Urdu.",
      privacy: "Your privacy matters. We don't store your documents permanently. Uploaded files are processed and then deleted.",
      cost: "You get 2-3 free scans per month. For unlimited scans, upgrade to our $8/month plan.",
      default: "I'm here to help! Ask me about uploading documents, languages we support, privacy, or how the site works."
    };
    
    const es = {
      hello: "¡Hola! Puedo ayudarte a entender facturas, cartas y documentos. Pregúntame: '¿Cómo subo un PDF?' o '¿Qué idiomas soportan?'",
      pdf: "Sí, puedes subir PDFs e imágenes. Las fotos claras y bien iluminadas funcionan mejor. Ve a Ayudante de Correo y Facturas para comenzar.",
      camera: "Usa el botón 'Tomar foto' en la página de Correo y Facturas. Asegúrate de que el texto esté nítido y llene el cuadro.",
      ocr: "OCR (Reconocimiento Óptico de Caracteres) lee texto de imágenes y PDFs. Usamos Azure Document Intelligence para extraer detalles clave como importes y fechas.",
      languages: "Soportamos 10 idiomas: inglés, español, portugués, francés, chino, hindi, árabe, bengalí, ruso y urdu.",
      privacy: "Tu privacidad importa. No guardamos tus documentos permanentemente. Los archivos subidos se procesan y luego se eliminan.",
      cost: "Tienes 2-3 escaneos gratis al mes. Para escaneos ilimitados, actualiza a nuestro plan de $8/mes.",
      default: "¡Estoy aquí para ayudar! Pregúntame sobre subir documentos, idiomas que soportamos, privacidad o cómo funciona el sitio."
    };
    
    const t = l === 'es' ? es : en;
    
    // Pattern matching
    if (q.includes("pdf")) return t.pdf;
    if (q.includes("camera") || q.includes("foto") || q.includes("picture") || q.includes("photo")) return t.camera;
    if (q.includes("ocr")) return t.ocr;
    if (q.includes("language") || q.includes("idioma") || q.includes("lang")) return t.languages;
    if (q.includes("privacy") || q.includes("privacidad") || q.includes("private") || q.includes("data")) return t.privacy;
    if (q.includes("cost") || q.includes("price") || q.includes("pay") || q.includes("costo") || q.includes("precio") || q.includes("pagar")) return t.cost;
    if (q.includes("hello") || q.includes("hola") || q.includes("hi") || q.includes("hey")) return t.hello;
    
    return t.default;
  }

  // Call backend assistant API
  async function callAssistantAPI(message, l) {
    if (!ASSISTANT_BASE) {
      return { reply: localHelper(message, l), mode: "local" };
    }

    const url = ASSISTANT_BASE + "/api/assistant";
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);

    try {
      // Check if we have document context
      const lastDoc = getLastDocument();
      
      const payload = {
        message: message,
        lang: l
      };

      // If we have a recent document, include it for context-aware responses
      if (lastDoc && lastDoc.summary) {
        payload.document_context = {
          summary: lastDoc.summary,
          document_type: lastDoc.document_type || "unknown",
          uploaded_at: lastDoc.uploaded_at || new Date().toISOString()
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });

      if (!res.ok) {
        throw new Error(res.status + " " + await res.text());
      }

      const data = await res.json();
      return { 
        reply: data.reply || data.message || localHelper(message, l),
        mode: lastDoc ? "document-aware" : "general"
      };
    } catch (e) {
      console.warn('[asst-widget] Backend unavailable, using local helper:', e.message);
      return { reply: localHelper(message, l), mode: "local" };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Inject FAB and panel
  const fab = document.createElement('button');
  fab.className = 'asst-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Open assistant');
  fab.textContent = lang() === 'es' ? 'Asistente' : 'Assistant';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'asst-panel';
  const panelHead = lang() === 'es' ? 'Asistente' : 'Assistant';
  const panelPlaceholder = lang() === 'es' ? 'Escribe tu pregunta…' : 'Type your question…';
  const panelSend = lang() === 'es' ? 'Enviar' : 'Send';
  
  panel.innerHTML = '<div class="asst-head">' + panelHead + '</div>' +
    '<div class="asst-body" id="asst-body"></div>' +
    '<div class="asst-foot">' +
      '<input id="asst-input" class="asst-input" type="text" placeholder="' + panelPlaceholder + '" />' +
      '<button id="asst-send" class="asst-send">' + panelSend + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  const body = panel.querySelector('#asst-body');
  const input = panel.querySelector('#asst-input');
  const send = panel.querySelector('#asst-send');

  // Add message to chat
  function push(role, text) {
    const d = document.createElement('div');
    d.className = 'asst-msg ' + role;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  // Seed greeting once
  const lastDoc = getLastDocument();
  if (lastDoc && lastDoc.summary) {
    const greeting = lang() === 'es'
      ? 'Hola! Veo que subiste un documento recientemente. Puedo responder preguntas sobre él, o ayudarte con el sitio.'
      : 'Hi! I see you uploaded a document recently. I can answer questions about it, or help you with the site.';
    push('bot', greeting);
  } else {
    const greeting = lang() === 'es'
      ? 'Soy tu asistente de Voyadecir. Pregúntame sobre facturas, correo, OCR o cargas.'
      : "I'm your Voyadecir assistant. Ask me about bills, mail, OCR, or uploads.";
    push('bot', greeting);
  }

  // Toggle panel
  fab.addEventListener('click', () => {
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) input.focus();
  });

  // Enter to send
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send.click();
    }
  });

  let pending = false;

  // Send message
  send.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text || pending) return;

    input.value = '';
    push('user', text);
    pending = true;

    // Show thinking indicator
    const thinkingText = lang() === 'es' ? 'Pensando…' : 'Thinking…';
    push('bot', thinkingText);
    const children = body.children;
    const thinking = children[children.length - 1];

    try {
      const resp = await callAssistantAPI(text, lang());
      
      // Remove thinking indicator
      if (thinking) thinking.remove();
      
      // Show response
      const fallbackText = lang() === 'es' ? 'No pude responder.' : "I couldn't answer.";
      push('bot', resp.reply || fallbackText);
      
      // Optional: log mode for debugging
      if (resp.mode === 'document-aware') {
        console.log('[asst-widget] Responded with document context');
      }
    } catch (err) {
      console.error('[asst-widget] Error:', err);
      if (thinking) thinking.remove();
      push('bot', localHelper(text, lang()));
    } finally {
      pending = false;
    }
  });

  // Listen for document uploads (other scripts can dispatch this event)
  window.addEventListener('voyadecir:document-uploaded', (e) => {
    try {
      const docData = {
        summary: e.detail.summary || '',
        document_type: e.detail.document_type || 'unknown',
        uploaded_at: new Date().toISOString()
      };
      sessionStorage.setItem('voyadecir_last_document', JSON.stringify(docData));
      console.log('[asst-widget] Document context stored for assistant');
    } catch (err) {
      console.warn('[asst-widget] Could not store document context:', err);
    }
  });

})();
