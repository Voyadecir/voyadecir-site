// If you wire a real endpoint later, set this to your Azure Function base URL.
// Example: const ASSISTANT_BASE = "https://voyadecir-ai-functions.azurewebsites.net";
// Then the code will POST to `${ASSISTANT_BASE}/api/assistant`.
const ASSISTANT_BASE = ""; // keep empty for now → uses safe local helper

const $ = (s) => document.querySelector(s);
function getLang() {
  try { return sessionStorage.getItem('voyadecir_lang') || 'en'; }
  catch (_) { return 'en'; }
}
function setStatus(msg){ const el = $('#asst-status'); if (el) el.textContent = msg; }

function appendMsg(role, text){
  const win = $('#chat-window');
  const row = document.createElement('div');
  row.className = `msg ${role}`;
  row.innerText = text;
  win.appendChild(row);
  win.scrollTop = win.scrollHeight;
}

// very basic built-in helper so this page works today
function localHelper(question, lang){
  const q = (question || "").toLowerCase();
  const en = {
    hello: "Hi! Ask me about translating bills, taking a photo, or supported file types. Try: “Can I upload a PDF?”",
    pdf: "Yes, you can upload PDFs and images. Clear, well-lit photos work best. For multi-page PDFs, we’ll start with page 1 now and add full-doc soon.",
    camera: "Use the Take Picture button on Mail & Bills. Make sure the text is sharp and fills the frame.",
    ocr: "OCR reads text in your image or PDF. We use Azure Vision + Document Intelligence to pull key fields like amount and due date.",
    default: "Got it. I’ll get smarter later when we connect the full assistant. For now, ask about upload, camera, OCR, or supported docs."
  };
  const es = {
    hello: "¡Hola! Pregúntame sobre traducir facturas, tomar una foto o los tipos de archivo. Prueba: “¿Puedo subir un PDF?”",
    pdf: "Sí, puedes subir archivos PDF e imágenes. Las fotos claras y bien iluminadas funcionan mejor. Para PDF de varias páginas, ahora usamos la primera página y pronto todo el documento.",
    camera: "Usa el botón Tomar foto en Correo y Facturas. Asegúrate de que el texto esté nítido y ocupe el cuadro.",
    ocr: "OCR lee el texto de tu imagen o PDF. Usamos Azure Vision + Document Intelligence para extraer campos clave como importe y fecha de vencimiento.",
    default: "Entendido. Pronto seré más inteligente cuando conectemos el asistente completo. Por ahora, pregunta sobre subir, cámara, OCR o documentos soportados."
  };
  const t = lang === 'es' ? es : en;
  if (q.includes("pdf")) return t.pdf;
  if (q.includes("camera") || q.includes("foto") || q.includes("picture")) return t.camera;
  if (q.includes("ocr")) return t.ocr;
  if (q.includes("hello") || q.includes("hola") || q.includes("hi")) return t.hello;
  return t.default;
}

async function callAssistantAPI(message, lang){
  if (!ASSISTANT_BASE) {
    // no backend yet → local helper
    return { reply: localHelper(message, lang), backend: "local" };
  }
  const url = `${ASSISTANT_BASE}/api/assistant`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ message, lang })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Assistant server ${res.status}: ${text}`);
  }
  return res.json();
}

window.addEventListener('DOMContentLoaded', function(){
  const form = $('#chat-form');
  const input = $('#chat-text');
  appendMsg('bot', getLang()==='es'
    ? "Soy tu asistente de Voyadecir. Pregúntame sobre facturas, correo, OCR o cargas."
    : "I’m your Voyadecir assistant. Ask me about bills, mail, OCR, or uploads.");

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    appendMsg('user', text);
    input.value = "";
    setStatus('Thinking…');
    try{
      const lang = getLang();
      const data = await callAssistantAPI(text, lang);
      const reply = data?.reply || (lang==='es' ? "Lo siento, no pude responder." : "Sorry, I couldn’t answer.");
      appendMsg('bot', reply);
      setStatus('Ready');
    }catch(err){
      console.error(err);
      appendMsg('bot', getLang()==='es'
        ? "Error del servidor. Intentaré el modo básico."
        : "Server error. I’ll fall back to the basic mode.");
      // fallback to local helper
      appendMsg('bot', localHelper(text, getLang()));
      setStatus('Ready');
    }
  });
});
