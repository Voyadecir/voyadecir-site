(function(){
  const LS_KEY = 'voyadecir_lang';
  const $ = s => document.querySelector(s);

  async function loadDict(lang){
    const ok = ['en','es'].includes(lang) ? lang : 'en';
    const res = await fetch(`/lang/${ok}.json`);
    return res.json();
  }

  function detect(){
    const saved = sessionStorage.getItem(LS_KEY);
    if (saved) return saved;
    const nav = navigator.language || navigator.userLanguage || 'en';
    return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
  }

  async function apply(lang){
    const dict = await loadDict(lang);

    // text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    // placeholders (NEW)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    // <html lang="...">
    document.documentElement.setAttribute('lang', lang);

    // save current lang globally for other scripts
    window.VD_LANG = lang;

    // toggle text
    const toggle = $('#lang-toggle');
    if (toggle) toggle.textContent = lang === 'es' ? 'ES | EN' : 'EN | ES';
  }

  async function init(){
    let lang = detect();
    sessionStorage.setItem(LS_KEY, lang);
    await apply(lang);

    const toggle = $('#lang-toggle');
    if (toggle){
      toggle.addEventListener('click', async function(){
        let cur = sessionStorage.getItem(LS_KEY) || 'en';
        let next = cur === 'en' ? 'es' : 'en';
        sessionStorage.setItem(LS_KEY, next);
        await apply(next);
      });
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
