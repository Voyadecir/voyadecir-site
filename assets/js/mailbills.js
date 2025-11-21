// Point Mail & Bills page to your Azure Function
const API_BASE = "https://voyadecir-ai-functions.azurewebsites.net"; // change only if your Function URL is different

// Read site language from session (set by main.js)
function getLang() {
  try { return sessionStorage.getItem('voyadecir_lang') || 'en'; }
  catch (_) { return 'en'; }
}

// Tiny helpers
const $ = (s) => document.querySelector(s);
function setStatus(msg) { const el = $('#status-line'); if (el) el.textContent = msg; }
function showResults(fields) {
  $('#results-card').style.display = 'block';
  $('#r-amount').textContent  = fields?.amount_due?.value != null ? `$${Number(fields.amount_due.value).toFixed(2)}` : '—';
  $('#r-duedate').textContent = fields?.due_date?.value || '—';
  $('#r-acct').textContent    = fields?.account_number?.value || '—';
  $('#r-sender').textContent  = fields?.sender?.value || '—';
  $('#r-address').textContent = fields?.service_address?.value || '—';
}

async function sendBytes(file) {
  const buf = await file.arrayBuffer();
  const lang = getLang() === 'es' ? 'es' : 'en';
  const url = `${API_BASE}/api/mailbills/parse?target_lang=${encodeURIComponent(lang)}`;
  const contentType = file.type || 'application/octet-stream';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: buf
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Server ${res.status}: ${txt}`);
  }
  return res.json();
}

async function handleFile(file) {
  if (!file) return;
  setStatus('Uploading…');
  try {
    const data = await sendBytes(file);
    setStatus('Processed.');
    $('#ocr-text').value     = data.ocr_text_snippet || '';
    $('#summary-text').value = data.summary_translated || data.summary_en || '';
    showResults(data.fields || {});
  } catch (err) {
    console.error(err);
    setStatus('Error from server.');
    alert('Server error. Check your Azure keys/endpoints, CORS, and Function logs.');
  }
}

window.addEventListener('DOMContentLoaded', function(){
  // Target language follows site language initially
  const tgt = $('#tgt-lang');
  if (tgt) tgt.value = getLang() === 'es' ? 'es' : 'en';

  $('#btn-upload')?.addEventListener('click', () => $('#file-input').click());
  $('#btn-camera')?.addEventListener('click', () => $('#camera-input').click());

  $('#file-input')?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
  $('#camera-input')?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

  $('#swap-langs')?.addEventListener('click', () => {
    const t = $('#tgt-lang');
    if (!t) return;
    t.value = t.value === 'es' ? 'en' : 'es';
    try { sessionStorage.setItem('voyadecir_lang', t.value); } catch (_) {}
  });
});
