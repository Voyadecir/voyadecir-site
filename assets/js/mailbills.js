// Mail & Bills — client → Azure Function
// Streams file bytes, asks server for summary + fields.
// Expects response: { ocr_text_snippet, summary_translated|summary_en, fields:{} }

// 1) Use your actual Function App default domain
const API_BASE = "https://voyadecir-ai-functions-aze4fqhjdcbzfkdu.centralus-01.azurewebsites.net";

// 2) Site language helper (from main.js session key)
function getLang() {
  try { return sessionStorage.getItem('voyadecir_lang') || 'en'; }
  catch (_) { return 'en'; }
}

// 3) Tiny DOM helpers
const $ = (s) => document.querySelector(s);
function setStatus(msg) { const el = $('#status-line'); if (el) el.textContent = msg; }
function valOrDash(v) { return (v !== undefined && v !== null && String(v).trim() !== "") ? String(v) : '—'; }

// 4) Render extracted fields card
function showResults(fields) {
  const card = $('#results-card');
  if (!card) return;

  const amt = fields?.amount_due?.value;
  const due = fields?.due_date?.value;
  const acc = fields?.account_number?.value;
  const snd = fields?.sender?.value;
  const adr = fields?.service_address?.value;

  $('#r-amount').textContent  = (amt != null && !isNaN(amt)) ? `$${Number(amt).toFixed(2)}` : valOrDash(amt);
  $('#r-duedate').textContent = valOrDash(due);
  $('#r-acct').textContent    = valOrDash(acc);
  $('#r-sender').textContent  = valOrDash(snd);
  $('#r-address').textContent = valOrDash(adr);

  const any = [amt, due, acc, snd, adr].some(x => x && String(x).trim() !== "");
  card.style.display = any ? 'block' : 'none';
}

// 5) POST raw bytes to Function
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

  // Try to parse JSON even on error for useful message
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(`Server error: ${msg}`);
  }
  return data;
}

// 6) Main handler
async function handleFile(file) {
  if (!file) return;
  setStatus('Uploading…');

  try {
    const data = await sendBytes(file);
    setStatus('Processed.');

    // Text areas
    $('#ocr-text').value     = data.ocr_text_snippet || '';
    $('#summary-text').value = data.summary_translated || data.summary_en || '';

    // Fields card
    showResults(data.fields || {});
  } catch (err) {
    console.error(err);
    setStatus('Error from server.');
    alert('Server error. Please check Azure Function logs, keys/endpoints, and CORS.');
  }
}

// 7) UI wiring
window.addEventListener('DOMContentLoaded', function () {
  const tgt = $('#tgt-lang');
  if (tgt) tgt.value = getLang() === 'es' ? 'es' : 'en';

  $('#btn-upload')?.addEventListener('click', () => $('#file-input').click());
  $('#btn-camera')?.addEventListener('click', () => $('#camera-input').click());

  $('#file-input')?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));
  $('#camera-input')?.addEventListener('change', (e) => handleFile(e.target.files?.[0]));

  // quick flip EN↔ES for "To"
  $('#swap-langs')?.addEventListener('click', () => {
    const t = $('#tgt-lang');
    if (!t) return;
    t.value = t.value === 'es' ? 'en' : 'es';
    try { sessionStorage.setItem('voyadecir_lang', t.value); } catch (_) {}
  });

  setStatus('Ready');
});
