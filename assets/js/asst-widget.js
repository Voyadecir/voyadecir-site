// When you're ready to go server→ set this:
// const ASSISTANT_BASE = "https://<your-func>.azurewebsites.net";
// It will POST to `${ASSISTANT_BASE}/api/assistant`
const ASSISTANT_BASE = ""; // empty means local helper

(function(){
  const lang = () => {
    try { return sessionStorage.getItem('voyadecir_lang') || 'en'; }
    catch (_) { return 'en'; }
  };

  // Tiny local helper so the widget works without backend
  function localHelper(q, l){
    q = (q||"").toLowerCase();
    const en = {
      hello: "Hi! Ask me about translating bills, taking a photo, or supported files. Try: “Can I upload a PDF?”",
      pdf: "Yes, PDFs and images work. Clear, well-lit photos are best. Multi-page PDFs: page 1 for now, full doc soon.",
      camera: "Use the Take Picture button on Mail & Bills. Fill the frame and keep text sharp.",
      ocr: "OCR reads text in images/PDF. We use Azure Vision + Document Intelligence to extract amount, due date, etc.",
      def: "Got it. I’ll be smarter when the full assistant is wired. For now: ask about upload, camera, OCR, supported docs."
    };
    const es = {
      hello: "¡Hola! Pregunta sobre traducir facturas, tomar foto o tipos de archivo. Prueba: “¿Puedo subir un PDF?”",
      pdf: "Sí, PDF e imágenes funcionan. Fotos claras e iluminadas son mejores. PDFs multi-página: ahora solo la primera.",
      camera: "Usa Tomar foto en Correo y Facturas. Llena el encuadre y mantén el texto nítido.",
      ocr: "OCR lee texto de imágenes/PDF. Usamos Azure Vision + Document Intelligence para importe, vencimiento, etc.",
      def: "Entendido. Seré más inteligente cuando conectemos el asistente completo. Por ahora: subida, cámara, OCR, docs."
    };
    const t = l==='es'? es: en;
    if (q.includes("pdf")) return t.pdf;
    if (q.includes("camera")||q.includes("foto")||q.includes("picture")) return t.camera;
    if (q.includes("ocr")) return t.ocr;
    if (q.includes("hello")||q.includes("hola")||q.includes("hi")) return t.hello;
    return t.def;
  }

  async function callAssistantAPI(message, l){
    if (!ASSISTANT_BASE) return { reply: localHelper(message, l) };
    const url = `${ASSISTANT_BASE}/api/assistant`;
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 12000);
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ message, lang: l }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return await res.json();
    }catch(e){
      return { reply: localHelper(message, l) };
    }finally{ clearTimeout(t); }
  }

  // Inject FAB and panel
  const css = document.createElement('style');
  css.textContent = `
  .asst-fab{
    position:fixed; right:16px; bottom:16px; z-index:9999;
    background:#000; color:#fff; border:none; border-radius:999px;
    padding:12px 14px; box-shadow:0 6px 20px rgba(0,0,0,.15); cursor:pointer;
    font-size:14px;
  }
  .asst-panel{
    position:fixed; right:16px; bottom:76px; z-index:9999; width:320px; max-height:60vh;
    background:#fff; border:1px solid #eee; border-radius:16px; display:none;
    box-shadow:0 8px 28px rgba(0,0,0,.2); overflow:hidden;
  }
  .asst-head{ padding:10px 12px; border-bottom:1px solid #eee; font-weight:600; }
  .asst-body{ padding:10px; height:260px; overflow:auto; font-size:14px; }
  .asst-msg{ margin:6px 0; }
  .asst-msg.user{ text-align:right; }
  .asst-foot{ display:flex; gap:6px; padding:10px; border-top:1px solid #eee; }
  .asst-input{ flex:1; padding:8px; border:1px solid #ddd; border-radius:10px; font-size:14px; }
  .asst-send{ padding:8px 10px; border:1px solid #000; border-radius:10px; background:#000; color:#fff; }
  `;
  document.head.appendChild(css);

  const fab = document.createElement('button');
  fab.className = 'asst-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label','Open assistant');
  fab.textContent = 'Assistant';
  document.body.appendChild(fab);

  const panel = document.createElement('div');
  panel.className = 'asst-panel';
  panel.innerHTML = `
    <div class="asst-head">${lang()==='es'?'Asistente':'Assistant'}</div>
    <div class="asst-body" id="asst-body"></div>
    <div class="asst-foot">
      <input id="asst-input" class="asst-input" type="text" placeholder="${lang()==='es'?'Escribe tu pregunta…':'Type your question…'}" />
      <button id="asst-send" class="asst-send">${lang()==='es'?'Enviar':'Send'}</button>
    </div>
  `;
  document.body.appendChild(panel);

  const body = panel.querySelector('#asst-body');
  const input = panel.querySelector('#asst-input');
  const send  = panel.querySelector('#asst-send');

  function push(role, text){
    const d = document.createElement('div');
    d.className = `asst-msg ${role}`;
    d.textContent = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  // seed greeting once
  push('bot', lang()==='es'
    ? 'Soy tu asistente de Voyadecir. Pregúntame sobre facturas, correo, OCR o cargas.'
    : 'I’m your Voyadecir assistant. Ask me about bills, mail, OCR, or uploads.');

  fab.addEventListener('click', ()=>{
    panel.style.display = panel.style.display === 'none' || !panel.style.display ? 'block' : 'none';
    if (panel.style.display === 'block') input.focus();
  });

  input.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      send.click();
    }
  });

  let pending = false;
  send.addEventListener('click', async ()=>{
    const text = input.value.trim();
    if (!text || pending) return;
    input.value = '';
    push('user', text);
    pending = true;
    push('bot', lang()==='es' ? 'Pensando…' : 'Thinking…');
    const children = body.children;
    const thinking = children[children.length - 1];
    try{
      const resp = await callAssistantAPI(text, lang());
      if (thinking) thinking.remove();
      push('bot', resp?.reply || (lang()==='es'?'No pude responder.':'I couldn’t answer.'));
    }catch(_){
      if (thinking) thinking.remove();
      push('bot', localHelper(text, lang()));
    }finally{
      pending = false;
    }
  });
})();
