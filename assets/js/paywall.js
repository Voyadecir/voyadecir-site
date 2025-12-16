/**
 * paywall.js - Usage gating scaffold (Problem 8)
 * - Tracks Mail & Bills successful runs locally (3 free uses)
 * - Shows in-page modal (no redirects)
 * NOTE: Real enforcement + abuse prevention should be done server-side.
 */
(function(){
  "use strict";
  const KEY="voyadecir_usage_mailbills";
  const LIMIT=3;

  const t=(k,f)=> (typeof window.voyT==="function" ? window.voyT(k,f) : f);

  function getCount(){
    try { return parseInt(localStorage.getItem(KEY)||"0",10) || 0; } catch(e){ return 0; }
  }
  function setCount(n){
    try { localStorage.setItem(KEY, String(n)); } catch(e){}
  }

  function ensureModal(){
    let m=document.getElementById("voy-paywall");
    if(m) return m;

    m=document.createElement("div");
    m.id="voy-paywall";
    m.className="voy-paywall";
    m.style.display="none";
    m.innerHTML = `
      <div class="voy-paywall__overlay"></div>
      <div class="voy-paywall__card glass">
        <h2 data-i18n="paywall.title">${t("paywall.title","Unlock unlimited use")}</h2>
        <p data-i18n="paywall.subtitle">${t("paywall.subtitle","You’ve used your 3 free uses.")}</p>

        <div class="voy-paywall__plans">
          <button class="voy-plan glass-button" data-plan="monthly">
            <div class="voy-plan__name" data-i18n="paywall.monthly">${t("paywall.monthly","Monthly")}</div>
            <div class="voy-plan__price" data-i18n="paywall.price_monthly">${t("paywall.price_monthly","$8.99/mo")}</div>
          </button>
          <button class="voy-plan glass-button" data-plan="annual">
            <div class="voy-plan__name" data-i18n="paywall.annual">${t("paywall.annual","Annual (save 1 month)")}</div>
            <div class="voy-plan__price" data-i18n="paywall.price_annual">${t("paywall.price_annual","$98.89/yr")}</div>
          </button>
        </div>

        <div class="voy-paywall__actions">
          <button class="voy-paywall__cta glass-button" data-cta>${t("paywall.cta","Upgrade")}</button>
          <button class="voy-paywall__later" data-later>${t("paywall.later","Not now")}</button>
        </div>

        <small class="voy-paywall__note">
          Stripe checkout will be embedded here later (no redirects). For now this is UI scaffolding.
        </small>
      </div>
    `;
    document.body.appendChild(m);

    // close logic
    m.querySelector("[data-later]").addEventListener("click", ()=> hide());
    m.querySelector(".voy-paywall__overlay").addEventListener("click", ()=> hide());

    // plan selection
    let selected="monthly";
    m.querySelectorAll(".voy-plan").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        selected = btn.getAttribute("data-plan") || "monthly";
        m.querySelectorAll(".voy-plan").forEach(b=>b.classList.toggle("is-selected", b===btn));
      });
    });
    m.querySelector('.voy-plan[data-plan="monthly"]').classList.add("is-selected");

    // CTA placeholder
    m.querySelector("[data-cta]").addEventListener("click", ()=>{
      // TODO: Embed Stripe Elements / Payment Element in this modal.
      alert("Stripe embed scaffolding only. We'll wire this after Problems 1–7 are stable.");
    });

    return m;
  }

  function show(){
    const m=ensureModal();
    m.style.display="block";
    document.body.classList.add("voy-modal-open");
  }
  function hide(){
    const m=document.getElementById("voy-paywall");
    if(!m) return;
    m.style.display="none";
    document.body.classList.remove("voy-modal-open");
  }

  function recordUse(){
    const n=getCount()+1;
    setCount(n);
    if(n>=LIMIT){
      show();
      return true;
    }
    return false;
  }

  window.VoyPaywall = { getCount, recordUse, show, hide, LIMIT };
})();
